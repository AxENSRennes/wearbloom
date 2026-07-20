import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Auth } from "./auth";
import type { AppConfig } from "./config";
import type { Database } from "./db/client";
import * as schema from "./db/schema";
import type { GarmentDetector } from "./ai/detection";
import type { PrivateStorage } from "./storage/storage";
import type { AppAttestVerifier } from "./security/app-attest";
import { RateLimitError, type RateLimiter } from "./security/rate-limit";
import { apiError, errorHandler } from "./http/errors";
import { createV1Routes, type ApiVariables } from "./http/routes";

type Env = { Variables: ApiVariables };

export function createApp(deps: { config: AppConfig; db: Database; storage: PrivateStorage; detector: GarmentDetector; auth: Auth; appAttest: AppAttestVerifier; rateLimiter: RateLimiter }) {
  const app = new OpenAPIHono<Env>();

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);
    c.header("X-Content-Type-Options", "nosniff");
    const started = performance.now();
    await next();
    console.log(JSON.stringify({
      level: "info", requestId, method: c.req.method, path: c.req.path,
      status: c.res.status, durationMs: Math.round(performance.now() - started),
    }));
  });

  app.get("/health", async (c) => {
    await deps.db.execute(sql`select 1`);
    const [heartbeat] = await deps.db.select().from(schema.workerHeartbeats)
      .where(gt(schema.workerHeartbeats.lastSeenAt, new Date(Date.now() - 60_000))).limit(1);
    return c.json({ status: "ok", api: true, worker: Boolean(heartbeat), version: "1.0.0" });
  });

  app.on(["GET", "POST"], "/v1/auth/*", (c) => deps.auth.handler(c.req.raw));

  app.post("/v1/webhooks/revenuecat", async (c) => {
    if (!deps.config.REVENUECAT_WEBHOOK_SECRET) return apiError(c, "NOT_FOUND", 404);
    if (c.req.header("authorization") !== `Bearer ${deps.config.REVENUECAT_WEBHOOK_SECRET}`) return apiError(c, "AUTH_REQUIRED", 401);
    const body = await c.req.json<{
      event?: { app_user_id?: string; product_id?: string; expiration_at_ms?: number | null; type?: string; entitlement_ids?: string[] };
    }>();
    const event = body.event;
    const ownerId = event?.app_user_id;
    if (!ownerId || !event) return c.json({ accepted: true }, 202);
    // Cancellation normally means "will not renew"; access remains active until expiration.
    const deactivation = new Set(["EXPIRATION"]);
    const isPro = event.entitlement_ids?.includes("pro") === true && !deactivation.has(event.type ?? "");
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : new Date("9999-12-31T00:00:00Z");
    await deps.db.insert(schema.entitlements).values({
      ownerId, revenueCatAppUserId: ownerId, productId: event.product_id, isPro, expiresAt, updatedAt: new Date(),
    }).onConflictDoUpdate({ target: schema.entitlements.ownerId, set: {
      revenueCatAppUserId: ownerId, productId: event.product_id, isPro, expiresAt, updatedAt: new Date(),
    } });
    return c.json({ accepted: true }, 202);
  });

  app.use("/v1/*", async (c, next) => {
    if (c.req.path.startsWith("/v1/auth/") || c.req.path.startsWith("/v1/webhooks/")) return next();
    const session = await deps.auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return apiError(c, "AUTH_REQUIRED", 401);
    c.set("userId", session.user.id);
    const rate = rateLimitRule(c.req.method, c.req.path);
    if (rate) {
      try {
        const remaining = await deps.rateLimiter.check(session.user.id, rate.action, rate.limit);
        c.header("X-RateLimit-Remaining", String(remaining));
      } catch (error) {
        if (error instanceof RateLimitError) return apiError(c, error.message, 429);
        throw error;
      }
    }
    if ((c.req.method === "POST" || c.req.method === "PUT") &&
        (c.req.path === "/v1/uploads" || c.req.path === "/v1/renders")) {
      c.set("rawBody", new Uint8Array(await c.req.raw.clone().arrayBuffer()));
    }
    return next();
  });

  app.get("/v1/assets/:id/content", async (c) => {
    const [asset] = await deps.db.select().from(schema.assets).where(and(
      eq(schema.assets.id, c.req.param("id")), eq(schema.assets.ownerId, c.get("userId")),
    )).limit(1);
    if (!asset || asset.deletedAt) return apiError(c, "NOT_FOUND", 404);
    const bytes = await deps.storage.get(asset.storageKey);
    return new Response(bytes, {
      headers: { "Content-Type": asset.contentType, "Cache-Control": "private, max-age=300", "Content-Disposition": "inline" },
    });
  });

  app.route("/v1", createV1Routes(deps));
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "WearBloom API", version: "1.0.0", description: "Private, authenticated API for the WearBloom iOS app." },
    servers: [{ url: deps.config.BETTER_AUTH_URL }],
  });
  app.notFound((c) => apiError(c, "NOT_FOUND", 404));
  app.onError(errorHandler);
  return app;
}

function rateLimitRule(method: string, path: string): { action: string; limit: number } | undefined {
  if (method === "GET" && path === "/v1/attest/challenge") return { action: "attest_challenge", limit: 60 };
  if (method === "POST" && path === "/v1/attest/verify") return { action: "attest_enroll", limit: 10 };
  if (method === "POST" && path === "/v1/uploads") return { action: "upload", limit: 30 };
  if (method === "POST" && path === "/v1/renders") return { action: "render", limit: 10 };
  return undefined;
}
