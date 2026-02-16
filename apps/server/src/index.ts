import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { toNodeHandler } from "better-auth/node";
import pino from "pino";

import type { AppleIapDeps } from "@acme/api";
import {
  appRouter,
  createAnonymousCleanupService,
  createTRPCContext,
} from "@acme/api";
import { initAuth } from "@acme/auth";
import { db } from "@acme/db/client";

import { env } from "./env";
import { createAppleWebhookHandler } from "./webhooks/apple";

const logger = pino({ name: "wearbloom-server" });

const auth = initAuth({
  baseUrl: `http://localhost:${env.PORT}`,
  productionUrl: `http://localhost:${env.PORT}`,
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

function nodeHeadersToHeaders(nodeHeaders: http.IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

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

    if (req.url?.startsWith("/api/auth")) {
      void authHandler(req, res);
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
