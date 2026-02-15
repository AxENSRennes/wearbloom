import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { toNodeHandler } from "better-auth/node";
import pino from "pino";

import {
  appRouter,
  createAnonymousCleanupService,
  createTRPCContext,
} from "@acme/api";
import { db } from "@acme/db/client";
import { initAuth } from "@acme/auth";

import { env } from "./env";

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

function nodeHeadersToHeaders(
  nodeHeaders: http.IncomingHttpHeaders,
): Headers {
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

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: ({ req }) =>
    createTRPCContext({
      headers: nodeHeadersToHeaders(req.headers),
      auth,
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

  if (req.url?.startsWith("/api/auth")) {
    authHandler(req, res);
    return;
  }

  trpcHandler(req, res);
});

server.listen(env.PORT);
logger.info({ port: env.PORT }, "Server listening");
logger.info({ port: env.PORT, path: "/health" }, "Health check available");
logger.info({ port: env.PORT, path: "/api/auth/*" }, "Auth routes available");
