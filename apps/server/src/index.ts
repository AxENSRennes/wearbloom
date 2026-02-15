import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { toNodeHandler } from "better-auth/node";
import pino from "pino";

import { appRouter, createTRPCContext } from "@acme/api";
import { createImageStorage } from "@acme/api/services/imageStorage";
import { initAuth } from "@acme/auth";
import { db } from "@acme/db/client";

import { env } from "./env";
import { createImageHandler } from "./routes/images";
import { nodeHeadersToHeaders } from "./utils/headers";

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

const imageHandler = createImageHandler({ db, auth, imageStorage });

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) =>
    createTRPCContext({
      headers: nodeHeadersToHeaders(req.headers),
      auth,
      imageStorage,
    }),
});

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date() }));
    return;
  }

  if (req.url?.startsWith("/api/auth")) {
    authHandler(req, res);
    return;
  }

  if (req.url?.startsWith("/api/images/")) {
    imageHandler(req, res);
    return;
  }

  trpcHandler(req, res);
});

server.listen(env.PORT);
logger.info(`Server listening on http://localhost:${env.PORT}`);
logger.info(`Health check: http://localhost:${env.PORT}/health`);
logger.info(`Auth routes: http://localhost:${env.PORT}/api/auth/*`);
logger.info(`Image routes: http://localhost:${env.PORT}/api/images/*`);
