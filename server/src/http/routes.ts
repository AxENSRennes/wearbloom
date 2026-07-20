import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { validateComposition } from "../domain/composition";
import { allowanceFor, canGenerate, quotaPeriod } from "../domain/quota";
import type { GarmentDetector } from "../ai/detection";
import { inspectImage } from "../images/metadata";
import type { PrivateStorage } from "../storage/storage";
import { AppAttestError, type AppAttestVerifier } from "../security/app-attest";
import { revokeAppleToken } from "../apple-auth";
import { apiError } from "./errors";
import { categorySchema, errorSchema, garmentInputSchema, idSchema, lookSchema, renderSchema, standardErrors } from "./schemas";

export type ApiVariables = { userId: string; requestId: string; rawBody?: Uint8Array };
type ApiEnv = { Variables: ApiVariables };
type Dependencies = { db: Database; storage: PrivateStorage; detector: GarmentDetector; config: AppConfig; appAttest: AppAttestVerifier };

const appAttestHeaders = z.object({
  "x-app-attest-challenge": z.string().optional(),
  "x-app-attest-key-id": z.string().optional(),
  "x-app-attest-assertion": z.string().optional(),
  "x-app-attest-unsupported": z.string().optional(),
});

const attestChallengeRoute = createRoute({
  method: "get", path: "/attest/challenge", tags: ["Integrity"],
  responses: { 200: { content: { "application/json": { schema: z.object({ challenge: z.string().uuid() }) } }, description: "One-time App Attest challenge" }, ...standardErrors },
});

const attestVerifyRoute = createRoute({
  method: "post", path: "/attest/verify", tags: ["Integrity"], request: {
    body: { content: { "application/json": { schema: z.object({ challenge: z.string().uuid(), keyId: z.string().min(10), attestation: z.string().min(20) }) } } },
  },
  responses: { 204: { description: "App Attest key enrolled" }, ...standardErrors },
});

const uploadRoute = createRoute({
  method: "post",
  path: "/uploads",
  tags: ["Images"],
  request: { headers: appAttestHeaders, body: { content: { "multipart/form-data": { schema: z.object({ image: z.any(), purpose: z.enum(["garment", "reference"]) }) } } } },
  responses: {
    201: { content: { "application/json": { schema: z.object({ id: idSchema, contentType: z.string(), width: z.number().nullable(), height: z.number().nullable() }) } }, description: "Private image stored" },
    ...standardErrors,
    422: { content: { "application/json": { schema: errorSchema } }, description: "Invalid upload" },
  },
});

const detectRoute = createRoute({
  method: "post",
  path: "/garments/detect",
  tags: ["Garments"],
  request: { body: { content: { "application/json": { schema: z.object({ assetId: idSchema }) } } } },
  responses: {
    200: { content: { "application/json": { schema: z.object({ category: categorySchema, confidence: z.number(), requiresConfirmation: z.boolean(), model: z.string() }) } }, description: "Garment category suggestion" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

const saveGarmentRoute = createRoute({
  method: "put", path: "/garments/{id}", tags: ["Garments"], request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().min(1).max(100), category: categorySchema, assetId: idSchema }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ id: idSchema, name: z.string(), category: categorySchema, assetId: idSchema }) } }, description: "Saved garment" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

const deleteGarmentRoute = createRoute({
  method: "delete", path: "/garments/{id}", tags: ["Garments"], request: { params: z.object({ id: idSchema }) },
  responses: { 204: { description: "Garment and its private source image deleted idempotently" }, ...standardErrors },
});

const saveReferenceRoute = createRoute({
  method: "put", path: "/references/{id}", tags: ["Images"], request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ assetId: idSchema, isDefault: z.boolean().default(false), generatedFromVariantId: idSchema.optional() }) } } },
  },
  responses: {
    200: { content: { "application/json": { schema: z.object({ id: idSchema, assetId: idSchema, isDefault: z.boolean() }) } }, description: "Saved private reference" },
    404: { content: { "application/json": { schema: errorSchema } }, description: "Asset not found" },
    ...standardErrors,
  },
});

const deleteReferenceRoute = createRoute({
  method: "delete", path: "/references/{id}", tags: ["Images"], request: { params: z.object({ id: idSchema }) },
  responses: { 204: { description: "Reference image deleted idempotently" }, ...standardErrors },
});

const saveLookRoute = createRoute({
  method: "put",
  path: "/looks/{id}",
  tags: ["Looks"],
  request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ name: z.string().min(1).max(100), note: z.string().max(1000).default(""), garments: z.array(garmentInputSchema).min(1).max(3) }) } } },
  },
  responses: { 200: { content: { "application/json": { schema: lookSchema } }, description: "Saved editable look" }, 404: { content: { "application/json": { schema: errorSchema } }, description: "Garment not found" }, ...standardErrors },
});

const deleteLookRoute = createRoute({
  method: "delete", path: "/looks/{id}", tags: ["Looks"], request: { params: z.object({ id: idSchema }) },
  responses: { 204: { description: "Look, variants, and generated result files deleted idempotently" }, ...standardErrors },
});

const createRenderRoute = createRoute({
  method: "post",
  path: "/renders",
  tags: ["Renders"],
  request: {
    headers: appAttestHeaders.extend({ "idempotency-key": z.string().min(8).max(200) }),
    body: { content: { "application/json": { schema: z.object({ lookId: idSchema, referencePhotoId: idSchema }) } } },
  },
  responses: {
    202: { content: { "application/json": { schema: renderSchema } }, description: "Render queued" },
    409: { content: { "application/json": { schema: errorSchema } }, description: "Idempotency conflict" },
    429: { content: { "application/json": { schema: errorSchema } }, description: "Allowance exhausted" },
    ...standardErrors,
  },
});

const getRenderRoute = createRoute({
  method: "get", path: "/renders/{id}", tags: ["Renders"], request: { params: z.object({ id: idSchema }) },
  responses: { 200: { content: { "application/json": { schema: renderSchema } }, description: "Immutable render variant" }, 404: { content: { "application/json": { schema: errorSchema } }, description: "Not found" }, ...standardErrors },
});

const feedbackRoute = createRoute({
  method: "post", path: "/renders/{id}/feedback", tags: ["Renders"], request: {
    params: z.object({ id: idSchema }),
    body: { content: { "application/json": { schema: z.object({ looksLikeMe: z.boolean(), helpful: z.boolean() }) } } },
  },
  responses: { 204: { description: "Feedback recorded" }, 404: { content: { "application/json": { schema: errorSchema } }, description: "Not found" }, ...standardErrors },
});

const deleteAccountRoute = createRoute({
  method: "delete", path: "/account", tags: ["Account"],
  responses: {
    202: { content: { "application/json": { schema: z.object({ cleanupQueued: z.number().int() }) } }, description: "Business data deleted and file cleanup queued" },
    409: { content: { "application/json": { schema: errorSchema } }, description: "Sign in with Apple reauthentication required" },
    ...standardErrors,
  },
});

const accountStatusRoute = createRoute({
  method: "get", path: "/account/status", tags: ["Account"],
  responses: {
    200: { content: { "application/json": { schema: z.object({
      userId: z.string(), isPro: z.boolean(), allowance: z.number().int(), used: z.number().int(), remaining: z.number().int(), periodKey: z.string(),
    }) } }, description: "Server-authoritative identity, entitlement, and generation allowance" },
    ...standardErrors,
  },
});

export function createV1Routes(deps: Dependencies) {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(attestChallengeRoute, async (c) => {
    const challenge = await deps.appAttest.issueChallenge(c.get("userId"));
    return c.json({ challenge }, 200);
  });

  app.openapi(attestVerifyRoute, async (c) => {
    try {
      await deps.appAttest.enroll({ ownerId: c.get("userId"), ...c.req.valid("json") });
      return c.body(null, 204);
    } catch (error) {
      return apiError(c, error instanceof AppAttestError ? error.message : "APP_ATTEST_REQUIRED", 403);
    }
  });

  app.openapi(uploadRoute, async (c) => {
    await verifyExpensiveRequest(c, deps);
    const input = await c.req.parseBody();
    const file = input.image;
    if (!(file instanceof File)) return apiError(c, "UPLOAD_INVALID_IMAGE", 422);
    if (file.size > 12 * 1024 * 1024) return apiError(c, "UPLOAD_TOO_LARGE", 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let metadata;
    try { metadata = inspectImage(bytes); } catch (error) { return apiError(c, (error as Error).message, 422); }
    if ((metadata.width ?? 0) > 10_000 || (metadata.height ?? 0) > 10_000) return apiError(c, "UPLOAD_INVALID_IMAGE", 422);
    const stored = await deps.storage.put({ ownerId: c.get("userId"), data: bytes, contentType: metadata.contentType, extension: metadata.extension });
    const [asset] = await deps.db.insert(schema.assets).values({
      ownerId: c.get("userId"), storageKey: stored.key, contentType: metadata.contentType, byteCount: stored.byteCount,
      sha256: stored.sha256, purpose: String(input.purpose), width: metadata.width, height: metadata.height,
    }).returning();
    if (!asset) throw new Error("INTERNAL_ERROR");
    return c.json({ id: asset.id, contentType: asset.contentType, width: asset.width, height: asset.height }, 201);
  });

  app.openapi(detectRoute, async (c) => {
    const { assetId } = c.req.valid("json");
    const [asset] = await deps.db.select().from(schema.assets).where(and(eq(schema.assets.id, assetId), eq(schema.assets.ownerId, c.get("userId")), isNull(schema.assets.deletedAt))).limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    const detection = await deps.detector.detect(await deps.storage.get(asset.storageKey), asset.contentType);
    return c.json({ ...detection, requiresConfirmation: detection.confidence < 0.82 }, 200);
  });

  app.openapi(saveGarmentRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const body = c.req.valid("json");
    const [asset] = await deps.db.select().from(schema.assets).where(and(eq(schema.assets.id, body.assetId), eq(schema.assets.ownerId, ownerId), isNull(schema.assets.deletedAt))).limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    await deps.db.insert(schema.garments).values({ id, ownerId, name: body.name, category: body.category, originalAssetId: asset.id })
      .onConflictDoUpdate({ target: schema.garments.id, set: { name: body.name, category: body.category, originalAssetId: asset.id, updatedAt: new Date() } });
    return c.json({ id, name: body.name, category: body.category, assetId: asset.id }, 200);
  });

  app.openapi(deleteGarmentRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const [garment] = await deps.db.select().from(schema.garments).where(and(eq(schema.garments.id, id), eq(schema.garments.ownerId, ownerId))).limit(1);
    if (!garment) return c.body(null, 204);
    const assetIds = [garment.originalAssetId, garment.cleanedAssetId].filter((value): value is string => value !== null);
    const ownedAssets = assetIds.length ? await deps.db.select().from(schema.assets).where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds))) : [];
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length) await transaction.insert(schema.cleanupJobs).values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey }))).onConflictDoNothing();
      await transaction.delete(schema.lookGarments).where(eq(schema.lookGarments.garmentId, id));
      await transaction.delete(schema.garments).where(and(eq(schema.garments.id, id), eq(schema.garments.ownerId, ownerId)));
      if (assetIds.length) await transaction.delete(schema.assets).where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)));
    });
    return c.body(null, 204);
  });

  app.openapi(saveReferenceRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const body = c.req.valid("json");
    const [asset] = await deps.db.select().from(schema.assets).where(and(eq(schema.assets.id, body.assetId), eq(schema.assets.ownerId, ownerId), isNull(schema.assets.deletedAt))).limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    await deps.db.transaction(async (transaction) => {
      if (body.isDefault) await transaction.update(schema.referencePhotos).set({ isDefault: false }).where(eq(schema.referencePhotos.ownerId, ownerId));
      await transaction.insert(schema.referencePhotos).values({
        id, ownerId, assetId: asset.id, isDefault: body.isDefault,
        ...(body.generatedFromVariantId ? { generatedFromVariantId: body.generatedFromVariantId } : {}),
      }).onConflictDoUpdate({ target: schema.referencePhotos.id, set: { assetId: asset.id, isDefault: body.isDefault } });
    });
    return c.json({ id, assetId: asset.id, isDefault: body.isDefault }, 200);
  });

  app.openapi(deleteReferenceRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const [reference] = await deps.db.select({ asset: schema.assets }).from(schema.referencePhotos)
      .innerJoin(schema.assets, eq(schema.referencePhotos.assetId, schema.assets.id))
      .where(and(eq(schema.referencePhotos.id, id), eq(schema.referencePhotos.ownerId, ownerId))).limit(1);
    if (!reference || reference.asset.deletedAt) return c.body(null, 204);
    await deps.db.transaction(async (transaction) => {
      await transaction.insert(schema.cleanupJobs).values({ storageKey: reference.asset.storageKey }).onConflictDoNothing();
      await transaction.update(schema.assets).set({ deletedAt: new Date() }).where(and(
        eq(schema.assets.id, reference.asset.id),
        eq(schema.assets.ownerId, ownerId),
      ));
    });
    return c.body(null, 204);
  });

  app.openapi(saveLookRoute, async (c) => {
    const ownerId = c.get("userId");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    validateComposition(body.garments);
    const ids = body.garments.map((piece) => piece.id);
    const owned = await deps.db.select({ id: schema.garments.id }).from(schema.garments).where(and(eq(schema.garments.ownerId, ownerId), inArray(schema.garments.id, ids)));
    if (owned.length !== ids.length) return apiError(c, "NOT_FOUND", 404);
    const now = new Date();
    await deps.db.transaction(async (transaction) => {
      await transaction.insert(schema.looks).values({ id, ownerId, name: body.name, note: body.note, updatedAt: now }).onConflictDoUpdate({ target: schema.looks.id, set: { name: body.name, note: body.note, updatedAt: now } });
      await transaction.delete(schema.lookGarments).where(eq(schema.lookGarments.lookId, id));
      await transaction.insert(schema.lookGarments).values(body.garments.map((piece) => ({ lookId: id, garmentId: piece.id, category: piece.category })));
    });
    return c.json({ id, name: body.name, note: body.note, garments: body.garments, updatedAt: now.toISOString() }, 200);
  });

  app.openapi(deleteLookRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const variants = await deps.db.select({ assetId: schema.renderVariants.resultAssetId }).from(schema.renderVariants)
      .where(and(eq(schema.renderVariants.lookId, id), eq(schema.renderVariants.ownerId, ownerId)));
    const assetIds = variants.map((variant) => variant.assetId).filter((value): value is string => value !== null);
    const ownedAssets = assetIds.length ? await deps.db.select().from(schema.assets).where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds))) : [];
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length) await transaction.insert(schema.cleanupJobs).values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey }))).onConflictDoNothing();
      if (assetIds.length) await transaction.delete(schema.assets).where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)));
      await transaction.delete(schema.looks).where(and(eq(schema.looks.id, id), eq(schema.looks.ownerId, ownerId)));
    });
    return c.body(null, 204);
  });

  app.openapi(createRenderRoute, async (c) => {
    await verifyExpensiveRequest(c, deps);
    const ownerId = c.get("userId");
    const key = c.req.valid("header")["idempotency-key"];
    const body = c.req.valid("json");
    const response = await deps.db.transaction(async (transaction) => {
      const [existing] = await transaction.select().from(schema.idempotencyKeys).where(and(eq(schema.idempotencyKeys.ownerId, ownerId), eq(schema.idempotencyKeys.key, key))).limit(1);
      if (existing?.responseBody) return existing.responseBody as RenderResponse;
      const [look] = await transaction.select().from(schema.looks).where(and(eq(schema.looks.id, body.lookId), eq(schema.looks.ownerId, ownerId), isNull(schema.looks.deletedAt))).limit(1);
      const [reference] = await transaction.select({ id: schema.referencePhotos.id }).from(schema.referencePhotos)
        .innerJoin(schema.assets, eq(schema.referencePhotos.assetId, schema.assets.id))
        .where(and(
          eq(schema.referencePhotos.id, body.referencePhotoId),
          eq(schema.referencePhotos.ownerId, ownerId),
          isNull(schema.assets.deletedAt),
        )).limit(1);
      if (!look || !reference) throw new Error("NOT_FOUND");
      const pieces = await transaction.select({ id: schema.garments.id, category: schema.lookGarments.category, name: schema.garments.name, assetId: schema.garments.originalAssetId })
        .from(schema.lookGarments).innerJoin(schema.garments, eq(schema.lookGarments.garmentId, schema.garments.id)).where(eq(schema.lookGarments.lookId, look.id));
      validateComposition(pieces);
      const now = new Date();
      const [entitlement] = await transaction.select().from(schema.entitlements).where(and(eq(schema.entitlements.ownerId, ownerId), eq(schema.entitlements.isPro, true), gt(schema.entitlements.expiresAt, now))).limit(1);
      const isPro = Boolean(entitlement);
      const periodKey = isPro ? quotaPeriod(now) : "free-lifetime";
      const allowance = allowanceFor({ isPro, freeAllowance: deps.config.FREE_RENDER_ALLOWANCE, paidAllowance: deps.config.PAID_MONTHLY_ALLOWANCE });
      const [usage] = await transaction.select({ units: sql<number>`coalesce(sum(${schema.quotaLedger.units}), 0)::int` }).from(schema.quotaLedger).where(and(eq(schema.quotaLedger.ownerId, ownerId), eq(schema.quotaLedger.periodKey, periodKey)));
      if (!canGenerate({ used: usage?.units ?? 0, allowance })) throw new Error("QUOTA_EXHAUSTED");
      const [variant] = await transaction.insert(schema.renderVariants).values({
        ownerId, lookId: look.id, referencePhotoId: reference.id, provider: deps.config.AI_PROVIDER,
        model: deps.config.IMAGE_MODEL, promptVersion: deps.config.PROMPT_VERSION,
        inputSnapshot: { look: { id: look.id, name: look.name }, garments: pieces.map(({ id, category, name, assetId }) => ({ id, category, name, assetId })), referencePhotoId: reference.id },
      }).returning();
      if (!variant) throw new Error("INTERNAL_ERROR");
      await transaction.insert(schema.quotaLedger).values({ ownerId, renderVariantId: variant.id, units: 1, reason: "render_reserved", periodKey });
      const result: RenderResponse = renderResponse(variant);
      await transaction.insert(schema.idempotencyKeys).values({ ownerId, key, operation: "create_render", responseStatus: 202, responseBody: result });
      return result;
    });
    return c.json(response, 202);
  });

  app.openapi(getRenderRoute, async (c) => {
    const [variant] = await deps.db.select().from(schema.renderVariants).where(and(eq(schema.renderVariants.id, c.req.valid("param").id), eq(schema.renderVariants.ownerId, c.get("userId")))).limit(1);
    if (!variant) return apiError(c, "NOT_FOUND", 404);
    return c.json(renderResponse(variant), 200);
  });

  app.openapi(feedbackRoute, async (c) => {
    const body = c.req.valid("json");
    const updated = await deps.db.update(schema.renderVariants).set({ looksLikeMe: body.looksLikeMe, helpful: body.helpful })
      .where(and(eq(schema.renderVariants.id, c.req.valid("param").id), eq(schema.renderVariants.ownerId, c.get("userId")))).returning({ id: schema.renderVariants.id });
    if (!updated.length) return apiError(c, "NOT_FOUND", 404);
    return c.body(null, 204);
  });

  app.openapi(accountStatusRoute, async (c) => {
    const ownerId = c.get("userId");
    const now = new Date();
    const [entitlement] = await deps.db.select().from(schema.entitlements).where(and(
      eq(schema.entitlements.ownerId, ownerId),
      eq(schema.entitlements.isPro, true),
      gt(schema.entitlements.expiresAt, now),
    )).limit(1);
    const isPro = Boolean(entitlement);
    const periodKey = isPro ? quotaPeriod(now) : "free-lifetime";
    const allowance = allowanceFor({ isPro, freeAllowance: deps.config.FREE_RENDER_ALLOWANCE, paidAllowance: deps.config.PAID_MONTHLY_ALLOWANCE });
    const [usage] = await deps.db.select({ units: sql<number>`coalesce(sum(${schema.quotaLedger.units}), 0)::int` })
      .from(schema.quotaLedger).where(and(eq(schema.quotaLedger.ownerId, ownerId), eq(schema.quotaLedger.periodKey, periodKey)));
    const used = usage?.units ?? 0;
    return c.json({ userId: ownerId, isPro, allowance, used, remaining: Math.max(0, allowance - used), periodKey }, 200);
  });

  app.openapi(deleteAccountRoute, async (c) => {
    const ownerId = c.get("userId");
    const [appleAccount] = await deps.db.select().from(schema.account).where(and(
      eq(schema.account.userId, ownerId),
      eq(schema.account.providerId, "apple"),
    )).limit(1);
    if (appleAccount) {
      const revocationToken = appleAccount.refreshToken ?? appleAccount.accessToken;
      if (!revocationToken) return apiError(c, "APPLE_REAUTH_REQUIRED", 409);
      await revokeAppleToken(
        deps.config,
        revocationToken,
        appleAccount.refreshToken ? "refresh_token" : "access_token",
      );
    }
    const ownedAssets = await deps.db.select({ storageKey: schema.assets.storageKey }).from(schema.assets).where(eq(schema.assets.ownerId, ownerId));
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length) await transaction.insert(schema.cleanupJobs).values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey }))).onConflictDoNothing();
      await transaction.delete(schema.user).where(eq(schema.user.id, ownerId));
    });
    return c.json({ cleanupQueued: ownedAssets.length }, 202);
  });

  return app;
}

async function verifyExpensiveRequest(c: Parameters<typeof apiError>[0], deps: Dependencies): Promise<void> {
  try {
    await deps.appAttest.verifyRequest({
      ownerId: c.get("userId") as string,
      challenge: c.req.header("x-app-attest-challenge"),
      keyId: c.req.header("x-app-attest-key-id"),
      assertion: c.req.header("x-app-attest-assertion"),
      unsupported: c.req.header("x-app-attest-unsupported"),
      method: c.req.method,
      path: c.req.path,
      body: (c.get("rawBody") as Uint8Array | undefined) ?? new Uint8Array(),
    });
  } catch (error) {
    const response = apiError(c, error instanceof AppAttestError ? error.message : "APP_ATTEST_REQUIRED", 403);
    throw new HTTPException(403, { res: response });
  }
}

type RenderRow = typeof schema.renderVariants.$inferSelect;
type RenderResponse = { id: string; lookId: string; status: RenderRow["status"]; resultURL: string | null; errorCode: string | null; createdAt: string; completedAt: string | null };

function renderResponse(row: RenderRow): RenderResponse {
  return {
    id: row.id, lookId: row.lookId, status: row.status,
    resultURL: row.resultAssetId ? `/v1/assets/${row.resultAssetId}/content` : null,
    errorCode: row.errorCode, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
  };
}
