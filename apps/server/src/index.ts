import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { toNodeHandler } from "better-auth/node";
import pino from "pino";

import { appRouter, createTRPCContext } from "@acme/api";
import { RateLimiter } from "@acme/api/rateLimit";
import { createBackgroundRemoval } from "@acme/api/services/backgroundRemoval";
import { createImageStorage } from "@acme/api/services/imageStorage";
import { initAuth } from "@acme/auth";
import { db } from "@acme/db/client";

import type { TryOnProvider } from "@acme/api/services/tryOnProvider";

import { env } from "./env";
import { createImageHandler } from "./routes/images";
import { nodeHeadersToHeaders } from "./utils/headers";
import { createFalWebhookHandler } from "./webhooks/fal";

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
  logger.warn({ err }, "TryOnProvider initialization failed — try-on features disabled");
}

const imageHandler = createImageHandler({ db, auth, imageStorage });

const falWebhookHandler = createFalWebhookHandler({
  db,
  imageStorage,
  logger,
});

// Rate limiter for auth routes — IP-based (audit S10-1)
const authLimiter = new RateLimiter(30, 60_000); // 30 req/min per IP

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) =>
    createTRPCContext({
      headers: nodeHeadersToHeaders(req.headers),
      auth,
      imageStorage,
      backgroundRemoval,
      tryOnProvider,
      renderTimeoutMs: env.RENDER_TIMEOUT_MS,
    }),
});

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date() }));
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

  if (req.url?.startsWith("/api/webhooks/fal") && req.method === "POST") {
    void falWebhookHandler(req, res);
    return;
  }

  if (req.url?.startsWith("/api/images/")) {
    void imageHandler(req, res);
    return;
  }

  trpcHandler(req, res);
});

server.listen(env.PORT);
logger.info(`Server listening on http://localhost:${env.PORT}`);
logger.info(`Health check: http://localhost:${env.PORT}/health`);
logger.info(`Auth routes: http://localhost:${env.PORT}/api/auth/*`);
logger.info(`Image routes: http://localhost:${env.PORT}/api/images/*`);
