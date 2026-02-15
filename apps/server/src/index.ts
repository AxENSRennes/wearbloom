import { createHTTPServer } from "@trpc/server/adapters/standalone";
import pino from "pino";

import { appRouter, createTRPCContext } from "@acme/api";

import { env } from "./env";

const logger = pino({ name: "wearbloom-server" });

const server = createHTTPServer({
  router: appRouter,
  createContext: ({ req }) =>
    createTRPCContext({
      headers: new Headers(req.headers as Record<string, string>),
    }),
  middleware: (req, res, next) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date() }));
      return;
    }
    next();
  },
});

server.listen(env.PORT);
logger.info(`Server listening on http://localhost:${env.PORT}`);
logger.info(`Health check: http://localhost:${env.PORT}/health`);
