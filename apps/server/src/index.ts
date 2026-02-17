import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { toNodeHandler } from "better-auth/node";
import pino from "pino";

import type { AppleIapDeps } from "@acme/api";
import type { TryOnProvider } from "@acme/api/services/tryOnProvider";
import {
  appRouter,
  createAnonymousCleanupService,
  createTRPCContext,
} from "@acme/api";
import { RateLimiter } from "@acme/api/rateLimit";
import { createBackgroundRemoval } from "@acme/api/services/backgroundRemoval";
import { createImageStorage } from "@acme/api/services/imageStorage";
import { initAuth } from "@acme/auth";
import { db } from "@acme/db/client";

import { env } from "./env";
import { createImageHandler } from "./routes/images";
import { nodeHeadersToHeaders } from "./utils/headers";
import { createAppleWebhookHandler } from "./webhooks/apple";
import { createFalWebhookHandler } from "./webhooks/fal";

const logger = pino({ name: "wearbloom-server" });
const localAuthUrl = `http://localhost:${env.PORT}`;

const auth = initAuth({
  baseUrl: env.BETTER_AUTH_BASE_URL ?? localAuthUrl,
  productionUrl: env.BETTER_AUTH_PRODUCTION_URL ?? localAuthUrl,
  secret: env.BETTER_AUTH_SECRET,
  appleBundleId: env.APPLE_BUNDLE_ID,
  isDev: env.NODE_ENV !== "production",
  logger,
});

const authHandler = toNodeHandler(auth);

// Initialize Apple IAP (optional — only when env vars are configured)
let appleIap: AppleIapDeps | undefined;
let appleWebhookHandler:
  | ReturnType<typeof createAppleWebhookHandler>
  | undefined;

if (env.APPLE_IAP_KEY_ID && env.APPLE_IAP_ISSUER_ID && env.APPLE_IAP_KEY_PATH) {
  try {
    const { createAppleClient, createVerifier } = await import(
      "@acme/api/services/appleIap"
    );
    const { createSubscriptionManager } = await import(
      "@acme/api/services/subscriptionManager"
    );

    const appleConfig = {
      appleIapKeyId: env.APPLE_IAP_KEY_ID,
      appleIapIssuerId: env.APPLE_IAP_ISSUER_ID,
      appleIapKeyPath: env.APPLE_IAP_KEY_PATH,
      appleBundleId: env.APPLE_BUNDLE_ID,
      appleAppId: env.APPLE_APP_ID,
      nodeEnv: env.NODE_ENV,
      certsDir: "./certs",
    };

    const verifier = createVerifier(appleConfig);
    const client = createAppleClient(appleConfig);
    const subscriptionManager = createSubscriptionManager({ db });

    // Type assertions needed: Apple library returns concrete class types
    // (JWSTransactionDecodedPayload) that lack index signatures required by
    // Record<string, unknown>. Our DI interfaces are intentionally loose.
    appleIap = {
      verifier: verifier as unknown as AppleIapDeps["verifier"],
      client,
    };

    appleWebhookHandler = createAppleWebhookHandler({
      verifier: verifier as unknown as Parameters<
        typeof createAppleWebhookHandler
      >[0]["verifier"],
      subscriptionManager,
      logger,
    });

    logger.info("Apple IAP configured and ready");
  } catch (err) {
    logger.warn(
      { error: String(err) },
      "Apple IAP initialization failed — IAP features disabled",
    );
  }
} else {
  logger.info(
    "Apple IAP not configured — set APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_PATH to enable",
  );
}

const imageStorage = createImageStorage({
  basePath: env.IMAGES_DIR,
  logger,
});

const backgroundRemoval = env.REPLICATE_API_TOKEN
  ? createBackgroundRemoval({
      replicateApiToken: env.REPLICATE_API_TOKEN,
      logger,
    })
  : undefined;

// Initialize TryOnProvider
let tryOnProvider: TryOnProvider | undefined;
try {
  const { createTryOnProvider } = await import(
    "@acme/api/services/tryOnProvider"
  );
  tryOnProvider = createTryOnProvider(env.ACTIVE_TRYON_PROVIDER, {
    falKey: env.FAL_KEY,
    webhookUrl: env.FAL_WEBHOOK_URL,
    nanoBananaModelId: env.FAL_NANO_BANANA_MODEL_ID,
    googleCloudProject: env.GOOGLE_CLOUD_PROJECT,
    googleCloudRegion: env.GOOGLE_CLOUD_REGION,
    googleAccessToken: env.GOOGLE_ACCESS_TOKEN,
    renderTimeoutMs: env.RENDER_TIMEOUT_MS,
  });
  logger.info(
    { provider: env.ACTIVE_TRYON_PROVIDER },
    "TryOnProvider initialized",
  );
} catch (err) {
  logger.warn(
    { err },
    "TryOnProvider initialization failed — try-on features disabled",
  );
}

const imageHandler = createImageHandler({ db, auth, imageStorage });

const falWebhookHandler = createFalWebhookHandler({
  db,
  imageStorage,
  logger,
});

// Rate limiter for auth routes — IP-based (audit S10-1)
const authLimiter = new RateLimiter(30, 60_000); // 30 req/min per IP

const MAX_BODY_SIZE = 65536; // 64KB — generous for Apple JWS payloads

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) =>
    createTRPCContext({
      headers: nodeHeadersToHeaders(req.headers),
      auth,
      freeCreditsCount: env.FREE_CREDITS_COUNT,
      appleIap,
      imageStorage,
      backgroundRemoval,
      tryOnProvider,
      renderTimeoutMs: env.RENDER_TIMEOUT_MS,
      anonymousConfig: {
        sessionTtlHours: env.ANONYMOUS_SESSION_TTL_HOURS,
        maxRenders: env.ANONYMOUS_MAX_RENDERS,
      },
    }),
});

const cleanupService = createAnonymousCleanupService({ db, logger });

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const server = http.createServer((req, res) => {
  void (async () => {
    if (req.url === "/health") {
      // Throttled fire-and-forget cleanup on health check
      const now = Date.now();
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        lastCleanupTime = now;
        cleanupService
          .cleanupExpiredAnonymousUsers(env.ANONYMOUS_SESSION_TTL_HOURS)
          .catch((err: unknown) => {
            logger.error(
              { err },
              "Anonymous cleanup failed during health check",
            );
          });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date() }));
      return;
    }

    // Apple webhook route — BEFORE tRPC catch-all
    if (req.url?.startsWith("/api/webhooks/apple") && req.method === "POST") {
      if (!appleWebhookHandler) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "APPLE_IAP_NOT_CONFIGURED" }));
        return;
      }

      try {
        const body = await readBody(req);
        const parsed: unknown = JSON.parse(body);
        const signedPayload =
          typeof parsed === "object" &&
          parsed !== null &&
          "signedPayload" in parsed
            ? (parsed as Record<string, unknown>).signedPayload
            : undefined;

        if (typeof signedPayload !== "string" || signedPayload.length === 0) {
          logger.warn("Apple webhook: missing or invalid signedPayload");
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "MISSING_SIGNED_PAYLOAD" }));
          return;
        }

        const result =
          await appleWebhookHandler.handleNotification(signedPayload);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
      } catch (err) {
        logger.error({ error: String(err) }, "Apple webhook: unhandled error");
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "INTERNAL_ERROR" }));
      }
      return;
    }

    if (req.url?.startsWith("/api/webhooks/fal") && req.method === "POST") {
      void falWebhookHandler(req, res);
      return;
    }

    if (req.url?.startsWith("/api/auth")) {
      const ip = req.socket.remoteAddress ?? "unknown";
      if (!authLimiter.check(ip)) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too many requests" }));
        return;
      }
      void authHandler(req, res);
      return;
    }

    if (req.url?.startsWith("/api/images/")) {
      void imageHandler(req, res);
      return;
    }

    trpcHandler(req, res);
  })();
});

server.listen(env.PORT);
logger.info({ port: env.PORT }, "Server listening");
logger.info({ port: env.PORT, path: "/health" }, "Health check available");
logger.info({ port: env.PORT, path: "/api/auth/*" }, "Auth routes available");
logger.info(
  { port: env.PORT, path: "/api/webhooks/apple" },
  "Apple webhook available",
);
logger.info(
  { port: env.PORT, path: "/api/images/*" },
  "Image routes available",
);
