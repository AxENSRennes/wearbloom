import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { renderResponseSchema, type RenderResponse } from "../domain/render-contract";
import { validateComposition } from "../domain/composition";
import { canGenerate } from "../domain/quota";
import { getQuotaSnapshot, lockOwnerQuota } from "../domain/quota-store";
import { upsertOwnedGarment, upsertOwnedLook, upsertOwnedReference } from "../domain/owned-records";
import { errorMessage } from "../errors";
import type { GarmentDetector } from "../ai/detection";
import { inspectImage } from "../images/metadata";
import type { PrivateStorage } from "../storage/storage";
import { AppAttestError, type AppAttestVerifier } from "../security/app-attest";
import { revokeAppleToken } from "../apple-auth";
import { apiError, throwApiError, validationHook } from "./errors";
import { track } from "../telemetry";
import { AppleSubscriptionError, type AppleSubscriptionService } from "../subscriptions/apple-subscriptions";
import type { ApiEnv } from "./env";

type Dependencies = {
  db: Database;
  storage: PrivateStorage;
  detector: GarmentDetector;
  config: AppConfig;
  appAttest: AppAttestVerifier;
  subscriptions: AppleSubscriptionService;
};

import {
  attestChallengeRoute,
  attestVerifyRoute,
  uploadRoute,
  detectRoute,
  saveGarmentRoute,
  deleteGarmentRoute,
  saveReferenceRoute,
  deleteReferenceRoute,
  saveLookRoute,
  deleteLookRoute,
  createRenderRoute,
  getRenderRoute,
  deleteRenderRoute,
  feedbackRoute,
  deleteAccountRoute,
  accountStatusRoute,
  getPrivacyPreferencesRoute,
  updatePrivacyPreferencesRoute,
  syncAppleSubscriptionRoute,
  registerPushDeviceRoute,
} from "./route-definitions";
export function createV1Routes(deps: Dependencies) {
  const app = new OpenAPIHono<ApiEnv>({ defaultHook: validationHook });

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
    const ownerId = c.get("userId");
    const [assetCount] = await deps.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.assets)
      .where(and(eq(schema.assets.ownerId, ownerId), isNull(schema.assets.deletedAt)));
    if ((assetCount?.count ?? 0) >= deps.config.MAX_ASSETS_PER_OWNER) return apiError(c, "UPLOAD_COUNT_EXCEEDED", 422);
    const input = c.req.valid("form");
    const file = input.image;
    if (!(file instanceof File)) return apiError(c, "UPLOAD_INVALID_IMAGE", 422);
    if (file.size > 12 * 1024 * 1024) return apiError(c, "UPLOAD_TOO_LARGE", 422);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let metadata: ReturnType<typeof inspectImage>;
    try {
      metadata = inspectImage(bytes);
    } catch (error) {
      return apiError(c, errorMessage(error, "UPLOAD_INVALID_IMAGE"), 422);
    }
    if ((metadata.width ?? 0) > 10_000 || (metadata.height ?? 0) > 10_000)
      return apiError(c, "UPLOAD_INVALID_IMAGE", 422);
    const stored = await deps.storage.put({
      ownerId,
      data: bytes,
      contentType: metadata.contentType,
      extension: metadata.extension,
    });
    const [asset] = await deps.db
      .insert(schema.assets)
      .values({
        ownerId,
        storageKey: stored.key,
        contentType: metadata.contentType,
        byteCount: stored.byteCount,
        sha256: stored.sha256,
        purpose: String(input.purpose),
        width: metadata.width,
        height: metadata.height,
      })
      .returning();
    if (!asset) throw new Error("INTERNAL_ERROR");
    return c.json({ id: asset.id, contentType: asset.contentType, width: asset.width, height: asset.height }, 201);
  });

  app.openapi(detectRoute, async (c) => {
    const { assetId } = c.req.valid("json");
    const [asset] = await deps.db
      .select()
      .from(schema.assets)
      .where(
        and(eq(schema.assets.id, assetId), eq(schema.assets.ownerId, c.get("userId")), isNull(schema.assets.deletedAt)),
      )
      .limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    const detection = await deps.detector.detect(await deps.storage.get(asset.storageKey), asset.contentType);
    return c.json({ ...detection, requiresConfirmation: detection.confidence < 0.82 }, 200);
  });

  app.openapi(saveGarmentRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const body = c.req.valid("json");
    const [asset] = await deps.db
      .select()
      .from(schema.assets)
      .where(
        and(eq(schema.assets.id, body.assetId), eq(schema.assets.ownerId, ownerId), isNull(schema.assets.deletedAt)),
      )
      .limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    const saved = await upsertOwnedGarment(deps.db, {
      id,
      ownerId,
      name: body.name,
      category: body.category,
      assetId: asset.id,
      now: new Date(),
    });
    if (!saved) return apiError(c, "NOT_FOUND", 404);
    return c.json({ id, name: body.name, category: body.category, assetId: asset.id }, 200);
  });

  app.openapi(deleteGarmentRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const [garment] = await deps.db
      .select()
      .from(schema.garments)
      .where(and(eq(schema.garments.id, id), eq(schema.garments.ownerId, ownerId)))
      .limit(1);
    if (!garment) return c.body(null, 204);
    const assetIds = [garment.originalAssetId, garment.cleanedAssetId].filter(
      (value): value is string => value !== null,
    );
    const ownedAssets = assetIds.length
      ? await deps.db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)))
      : [];
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length)
        await transaction
          .insert(schema.cleanupJobs)
          .values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey })))
          .onConflictDoNothing();
      await transaction.delete(schema.lookGarments).where(eq(schema.lookGarments.garmentId, id));
      await transaction
        .delete(schema.garments)
        .where(and(eq(schema.garments.id, id), eq(schema.garments.ownerId, ownerId)));
      if (assetIds.length)
        await transaction
          .delete(schema.assets)
          .where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)));
    });
    return c.body(null, 204);
  });

  app.openapi(saveReferenceRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const body = c.req.valid("json");
    const [asset] = await deps.db
      .select()
      .from(schema.assets)
      .where(
        and(eq(schema.assets.id, body.assetId), eq(schema.assets.ownerId, ownerId), isNull(schema.assets.deletedAt)),
      )
      .limit(1);
    if (!asset) return apiError(c, "NOT_FOUND", 404);
    if (body.generatedFromVariantId) {
      const [sourceVariant] = await deps.db
        .select({ id: schema.renderVariants.id })
        .from(schema.renderVariants)
        .where(
          and(
            eq(schema.renderVariants.id, body.generatedFromVariantId),
            eq(schema.renderVariants.ownerId, ownerId),
            eq(schema.renderVariants.status, "succeeded"),
          ),
        )
        .limit(1);
      if (!sourceVariant) return apiError(c, "NOT_FOUND", 404);
    }
    try {
      await deps.db.transaction(async (transaction) => {
        const saved = await upsertOwnedReference(transaction, {
          id,
          ownerId,
          assetId: asset.id,
          isDefault: body.isDefault,
          ...(body.generatedFromVariantId ? { generatedFromVariantId: body.generatedFromVariantId } : {}),
        });
        if (!saved) throw new Error("NOT_FOUND");
        if (body.isDefault)
          await transaction
            .update(schema.referencePhotos)
            .set({ isDefault: false })
            .where(and(eq(schema.referencePhotos.ownerId, ownerId), sql`${schema.referencePhotos.id} <> ${id}`));
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") return apiError(c, "NOT_FOUND", 404);
      throw error;
    }
    return c.json({ id, assetId: asset.id, isDefault: body.isDefault }, 200);
  });

  app.openapi(deleteReferenceRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const [reference] = await deps.db
      .select({ asset: schema.assets })
      .from(schema.referencePhotos)
      .innerJoin(schema.assets, eq(schema.referencePhotos.assetId, schema.assets.id))
      .where(and(eq(schema.referencePhotos.id, id), eq(schema.referencePhotos.ownerId, ownerId)))
      .limit(1);
    if (!reference || reference.asset.deletedAt) return c.body(null, 204);
    await deps.db.transaction(async (transaction) => {
      await transaction
        .insert(schema.cleanupJobs)
        .values({ storageKey: reference.asset.storageKey })
        .onConflictDoNothing();
      await transaction
        .delete(schema.referencePhotos)
        .where(and(eq(schema.referencePhotos.id, id), eq(schema.referencePhotos.ownerId, ownerId)));
      await transaction
        .delete(schema.assets)
        .where(and(eq(schema.assets.id, reference.asset.id), eq(schema.assets.ownerId, ownerId)));
    });
    return c.body(null, 204);
  });

  app.openapi(saveLookRoute, async (c) => {
    const ownerId = c.get("userId");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    validateComposition(body.garments);
    const ids = body.garments.map((piece) => piece.id);
    const owned = await deps.db
      .select({ id: schema.garments.id })
      .from(schema.garments)
      .where(and(eq(schema.garments.ownerId, ownerId), inArray(schema.garments.id, ids)));
    if (owned.length !== ids.length) return apiError(c, "NOT_FOUND", 404);
    const now = new Date();
    try {
      await deps.db.transaction(async (transaction) => {
        const saved = await upsertOwnedLook(transaction, {
          id,
          ownerId,
          name: body.name,
          note: body.note,
          garments: body.garments,
          now,
        });
        if (!saved) throw new Error("NOT_FOUND");
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") return apiError(c, "NOT_FOUND", 404);
      throw error;
    }
    return c.json({ id, name: body.name, note: body.note, garments: body.garments, updatedAt: now.toISOString() }, 200);
  });

  app.openapi(deleteLookRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const variants = await deps.db
      .select({ assetId: schema.renderVariants.resultAssetId })
      .from(schema.renderVariants)
      .where(and(eq(schema.renderVariants.lookId, id), eq(schema.renderVariants.ownerId, ownerId)));
    const assetIds = variants.map((variant) => variant.assetId).filter((value): value is string => value !== null);
    const ownedAssets = assetIds.length
      ? await deps.db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)))
      : [];
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length)
        await transaction
          .insert(schema.cleanupJobs)
          .values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey })))
          .onConflictDoNothing();
      if (assetIds.length)
        await transaction
          .delete(schema.assets)
          .where(and(eq(schema.assets.ownerId, ownerId), inArray(schema.assets.id, assetIds)));
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
      const [existing] = await transaction
        .select()
        .from(schema.idempotencyKeys)
        .where(and(eq(schema.idempotencyKeys.ownerId, ownerId), eq(schema.idempotencyKeys.key, key)))
        .limit(1);
      if (existing?.responseBody) return renderResponseSchema.parse(existing.responseBody);
      const [look] = await transaction
        .select()
        .from(schema.looks)
        .where(and(eq(schema.looks.id, body.lookId), eq(schema.looks.ownerId, ownerId), isNull(schema.looks.deletedAt)))
        .limit(1);
      const [reference] = await transaction
        .select({ id: schema.referencePhotos.id })
        .from(schema.referencePhotos)
        .innerJoin(schema.assets, eq(schema.referencePhotos.assetId, schema.assets.id))
        .where(
          and(
            eq(schema.referencePhotos.id, body.referencePhotoId),
            eq(schema.referencePhotos.ownerId, ownerId),
            isNull(schema.assets.deletedAt),
          ),
        )
        .limit(1);
      if (!look || !reference) throw new Error("NOT_FOUND");
      const pieces = await transaction
        .select({
          id: schema.garments.id,
          category: schema.lookGarments.category,
          name: schema.garments.name,
          assetId: schema.garments.originalAssetId,
        })
        .from(schema.lookGarments)
        .innerJoin(schema.garments, eq(schema.lookGarments.garmentId, schema.garments.id))
        .where(eq(schema.lookGarments.lookId, look.id));
      validateComposition(pieces);
      await lockOwnerQuota(transaction, ownerId);
      const quota = await getQuotaSnapshot(transaction, ownerId, new Date(), deps.config);
      if (!canGenerate({ used: quota.used, allowance: quota.allowance })) throw new Error("QUOTA_EXHAUSTED");
      const [variant] = await transaction
        .insert(schema.renderVariants)
        .values({
          id: body.renderId,
          ownerId,
          lookId: look.id,
          referencePhotoId: reference.id,
          provider: deps.config.AI_PROVIDER,
          model: deps.config.IMAGE_MODEL,
          promptVersion: deps.config.PROMPT_VERSION,
          inputSnapshot: {
            look: { id: look.id, name: look.name },
            garments: pieces.map(({ id, category, name, assetId }) => ({ id, category, name, assetId })),
            referencePhotoId: reference.id,
          },
        })
        .returning();
      if (!variant) throw new Error("INTERNAL_ERROR");
      await transaction.insert(schema.quotaLedger).values({
        ownerId,
        renderVariantId: variant.id,
        units: 1,
        reason: "render_reserved",
        periodKey: quota.periodKey,
      });
      const result: RenderResponse = renderResponse(variant);
      await transaction
        .insert(schema.idempotencyKeys)
        .values({ ownerId, key, operation: "create_render", responseStatus: 202, responseBody: result });
      return result;
    });
    await track("render_queued", ownerId, { render_id: response.id, provider: deps.config.AI_PROVIDER });
    return c.json(response, 202);
  });

  app.openapi(getRenderRoute, async (c) => {
    const [variant] = await deps.db
      .select()
      .from(schema.renderVariants)
      .where(
        and(eq(schema.renderVariants.id, c.req.valid("param").id), eq(schema.renderVariants.ownerId, c.get("userId"))),
      )
      .limit(1);
    if (!variant) return apiError(c, "NOT_FOUND", 404);
    return c.json(renderResponse(variant), 200);
  });

  app.openapi(deleteRenderRoute, async (c) => {
    const ownerId = c.get("userId");
    const id = c.req.valid("param").id;
    const [variant] = await deps.db
      .select()
      .from(schema.renderVariants)
      .where(and(eq(schema.renderVariants.id, id), eq(schema.renderVariants.ownerId, ownerId)))
      .limit(1);
    if (!variant) return c.body(null, 204);
    if (variant.status === "queued" || variant.status === "processing") return apiError(c, "RENDER_IN_PROGRESS", 409);
    const resultAssetId = variant.resultAssetId;
    const ownedAssets = resultAssetId
      ? await deps.db
          .select()
          .from(schema.assets)
          .where(and(eq(schema.assets.id, resultAssetId), eq(schema.assets.ownerId, ownerId)))
      : [];
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length && resultAssetId) {
        await transaction
          .insert(schema.cleanupJobs)
          .values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey })))
          .onConflictDoNothing();
        await transaction
          .delete(schema.assets)
          .where(and(eq(schema.assets.id, resultAssetId), eq(schema.assets.ownerId, ownerId)));
      }
      await transaction
        .delete(schema.renderVariants)
        .where(and(eq(schema.renderVariants.id, id), eq(schema.renderVariants.ownerId, ownerId)));
    });
    return c.body(null, 204);
  });

  app.openapi(feedbackRoute, async (c) => {
    const body = c.req.valid("json");
    const updated = await deps.db
      .update(schema.renderVariants)
      .set({ looksLikeMe: body.looksLikeMe, helpful: body.helpful })
      .where(
        and(eq(schema.renderVariants.id, c.req.valid("param").id), eq(schema.renderVariants.ownerId, c.get("userId"))),
      )
      .returning({ id: schema.renderVariants.id });
    if (!updated.length) return apiError(c, "NOT_FOUND", 404);
    await track("render_feedback_submitted", c.get("userId"), {
      render_id: c.req.valid("param").id,
      looks_like_me: body.looksLikeMe,
      helpful: body.helpful,
    });
    return c.body(null, 204);
  });

  app.openapi(accountStatusRoute, async (c) => {
    const ownerId = c.get("userId");
    await deps.subscriptions.reconcileOwner(ownerId);
    const entitlement = await deps.subscriptions.ensureAccount(ownerId);
    const quota = await getQuotaSnapshot(deps.db, ownerId, new Date(), deps.config);
    return c.json({ userId: ownerId, appAccountToken: entitlement.appleAppAccountToken, ...quota }, 200);
  });

  app.openapi(getPrivacyPreferencesRoute, async (c) => {
    const [preference] = await deps.db
      .select()
      .from(schema.privacyPreferences)
      .where(eq(schema.privacyPreferences.ownerId, c.get("userId")))
      .limit(1);
    return c.json(
      {
        analyticsEnabled: preference?.analyticsEnabled ?? false,
        diagnosticsEnabled: preference?.diagnosticsEnabled ?? false,
        consentVersion: preference?.consentVersion ?? 1,
        updatedAt: (preference?.updatedAt ?? new Date(0)).toISOString(),
      },
      200,
    );
  });

  app.openapi(updatePrivacyPreferencesRoute, async (c) => {
    const ownerId = c.get("userId");
    const body = c.req.valid("json");
    const now = new Date();
    const [preference] = await deps.db
      .insert(schema.privacyPreferences)
      .values({
        ownerId,
        analyticsEnabled: body.analyticsEnabled,
        diagnosticsEnabled: body.diagnosticsEnabled,
        consentVersion: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.privacyPreferences.ownerId,
        set: {
          analyticsEnabled: body.analyticsEnabled,
          diagnosticsEnabled: body.diagnosticsEnabled,
          consentVersion: 1,
          updatedAt: now,
        },
      })
      .returning();
    if (!preference) throw new Error("INTERNAL_ERROR");
    return c.json(
      {
        analyticsEnabled: preference.analyticsEnabled,
        diagnosticsEnabled: preference.diagnosticsEnabled,
        consentVersion: preference.consentVersion,
        updatedAt: preference.updatedAt.toISOString(),
      },
      200,
    );
  });

  app.openapi(syncAppleSubscriptionRoute, async (c) => {
    try {
      await deps.subscriptions.syncTransactions(c.get("userId"), c.req.valid("json").signedTransactions);
      return c.json({ synced: true as const }, 200);
    } catch (error) {
      if (!(error instanceof AppleSubscriptionError)) throw error;
      if (error.message === "APPLE_SUBSCRIPTIONS_NOT_CONFIGURED") {
        throwApiError(c, error.message, 503);
      }
      if (error.message === "APPLE_SUBSCRIPTION_ALREADY_LINKED") {
        throwApiError(c, error.message, 409);
      }
      throwApiError(c, error.message, 422);
    }
  });

  app.openapi(registerPushDeviceRoute, async (c) => {
    const ownerId = c.get("userId");
    const body = c.req.valid("json");
    await deps.db
      .insert(schema.deviceTokens)
      .values({
        token: body.token,
        ownerId,
        environment: body.environment,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.deviceTokens.token,
        set: {
          ownerId,
          environment: body.environment,
          updatedAt: new Date(),
        },
      });
    return c.body(null, 204);
  });

  app.openapi(deleteAccountRoute, async (c) => {
    const ownerId = c.get("userId");
    const [appleAccount] = await deps.db
      .select()
      .from(schema.account)
      .where(and(eq(schema.account.userId, ownerId), eq(schema.account.providerId, "apple")))
      .limit(1);
    if (appleAccount) {
      const revocationToken = appleAccount.refreshToken ?? appleAccount.accessToken;
      if (!revocationToken) return apiError(c, "APPLE_REAUTH_REQUIRED", 409);
      await revokeAppleToken(
        deps.config,
        revocationToken,
        appleAccount.refreshToken ? "refresh_token" : "access_token",
      );
    }
    const ownedAssets = await deps.db
      .select({ storageKey: schema.assets.storageKey })
      .from(schema.assets)
      .where(eq(schema.assets.ownerId, ownerId));
    await deps.db.transaction(async (transaction) => {
      if (ownedAssets.length)
        await transaction
          .insert(schema.cleanupJobs)
          .values(ownedAssets.map((asset) => ({ storageKey: asset.storageKey })))
          .onConflictDoNothing();
      await transaction.delete(schema.user).where(eq(schema.user.id, ownerId));
    });
    return c.json({ cleanupQueued: ownedAssets.length }, 202);
  });

  return app;
}

async function verifyExpensiveRequest(c: Context<ApiEnv>, deps: Dependencies): Promise<void> {
  try {
    await deps.appAttest.verifyRequest({
      ownerId: c.get("userId"),
      challenge: c.req.header("x-app-attest-challenge"),
      keyId: c.req.header("x-app-attest-key-id"),
      assertion: c.req.header("x-app-attest-assertion"),
      unsupported: c.req.header("x-app-attest-unsupported"),
      method: c.req.method,
      path: c.req.path,
      body: c.get("rawBody") ?? new Uint8Array(),
    });
  } catch (error) {
    const response = apiError(c, error instanceof AppAttestError ? error.message : "APP_ATTEST_REQUIRED", 403);
    throw new HTTPException(403, { res: response });
  }
}

type RenderRow = typeof schema.renderVariants.$inferSelect;

function renderResponse(row: RenderRow): RenderResponse {
  return {
    id: row.id,
    lookId: row.lookId,
    status: row.status,
    resultURL: row.resultAssetId ? `/v1/assets/${row.resultAssetId}/content` : null,
    errorCode: row.errorCode,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
