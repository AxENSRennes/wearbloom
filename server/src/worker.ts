import OpenAI from "openai";
import { hostname } from "node:os";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { loadConfig } from "./config";
import { createDatabase } from "./db/client";
import * as schema from "./db/schema";
import type { GenerationInput, ImageGenerationProvider } from "./ai/provider";
import { OpenAIImageProvider } from "./ai/openai-provider";
import { StubImageProvider } from "./ai/stub-provider";
import { LocalPrivateStorage } from "./storage/local-storage";
import { APNSClient } from "./notifications/apns";
import { captureException, configureTelemetry, track } from "./telemetry";

const config = loadConfig({ ...process.env, ROLE: "worker" });
configureTelemetry(config, "worker");
const { db } = createDatabase(config);
const storage = new LocalPrivateStorage(config.STORAGE_ROOT);
const provider: ImageGenerationProvider =
  config.AI_PROVIDER === "openai"
    ? new OpenAIImageProvider(config.IMAGE_MODEL, new OpenAI({ apiKey: config.OPENAI_API_KEY }))
    : new StubImageProvider();
const workerId = `${hostname()}-${process.pid}`;
const push = new APNSClient(config);

async function claimRender(): Promise<string | undefined> {
  return db.transaction(async (transaction) => {
    const rows = await transaction.execute<{ id: string }>(sql`
      select id from render_variants
      where status = 'queued'
      order by created_at asc
      for update skip locked
      limit 1
    `);
    const id = rows[0]?.id;
    if (!id) return undefined;
    await transaction
      .update(schema.renderVariants)
      .set({
        status: "processing",
        startedAt: new Date(),
        attemptCount: sql`${schema.renderVariants.attemptCount} + 1`,
      })
      .where(eq(schema.renderVariants.id, id));
    return id;
  });
}

async function processRender(id: string): Promise<void> {
  const [variant] = await db.select().from(schema.renderVariants).where(eq(schema.renderVariants.id, id)).limit(1);
  if (!variant) return;
  const started = Date.now();
  try {
    if (!variant.referencePhotoId) throw new Error("REFERENCE_MISSING");
    const [reference] = await db
      .select({ asset: schema.assets })
      .from(schema.referencePhotos)
      .innerJoin(schema.assets, eq(schema.referencePhotos.assetId, schema.assets.id))
      .where(eq(schema.referencePhotos.id, variant.referencePhotoId))
      .limit(1);
    if (!reference) throw new Error("REFERENCE_MISSING");
    const snapshot = variant.inputSnapshot as {
      garments: Array<{ name: string; category: string; assetId: string | null }>;
    };
    const garments: GenerationInput["garments"] = [];
    for (const piece of snapshot.garments) {
      if (!piece.assetId) throw new Error("GARMENT_IMAGE_MISSING");
      const [asset] = await db.select().from(schema.assets).where(eq(schema.assets.id, piece.assetId)).limit(1);
      if (!asset) throw new Error("GARMENT_IMAGE_MISSING");
      garments.push({
        name: piece.name,
        category: piece.category,
        contentType: asset.contentType,
        bytes: await storage.get(asset.storageKey),
      });
    }
    const output = await provider.generate({
      reference: { bytes: await storage.get(reference.asset.storageKey), contentType: reference.asset.contentType },
      garments,
      promptVersion: variant.promptVersion,
      size: config.IMAGE_SIZE,
    });
    const stored = await storage.put({
      ownerId: variant.ownerId,
      data: output.bytes,
      contentType: output.contentType,
      extension: output.contentType === "image/png" ? "png" : "jpg",
    });
    await db.transaction(async (transaction) => {
      const [asset] = await transaction
        .insert(schema.assets)
        .values({
          ownerId: variant.ownerId,
          storageKey: stored.key,
          contentType: stored.contentType,
          byteCount: stored.byteCount,
          sha256: stored.sha256,
          purpose: "render",
        })
        .returning();
      if (!asset) throw new Error("ASSET_WRITE_FAILED");
      await transaction
        .update(schema.renderVariants)
        .set({
          status: "succeeded",
          resultAssetId: asset.id,
          completedAt: new Date(),
          providerRequestId: output.providerRequestId,
          costMicros: config.IMAGE_COST_MICROS,
        })
        .where(eq(schema.renderVariants.id, variant.id));
    });
    await notifyOwner(variant.ownerId, variant.id, "succeeded").catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Render notification failed",
          renderId: id,
          code: (error as Error).message,
        }),
      );
    });
    console.log(
      JSON.stringify({
        level: "info",
        message: "Render completed",
        renderId: id,
        ownerId: variant.ownerId,
        queueLatencyMs: variant.startedAt ? variant.startedAt.getTime() - variant.createdAt.getTime() : null,
        durationMs: Date.now() - started,
        costMicros: config.IMAGE_COST_MICROS,
      }),
    );
    track("render_succeeded", variant.ownerId, {
      render_id: id,
      duration_ms: Date.now() - started,
      cost_micros: config.IMAGE_COST_MICROS,
      provider: provider.name,
    });
  } catch (error) {
    const code = (error as Error).message.slice(0, 100);
    await db.transaction(async (transaction) => {
      await transaction
        .update(schema.renderVariants)
        .set({ status: "failed", errorCode: code, completedAt: new Date() })
        .where(eq(schema.renderVariants.id, variant.id));
      const [reservation] = await transaction
        .select()
        .from(schema.quotaLedger)
        .where(
          and(eq(schema.quotaLedger.renderVariantId, variant.id), eq(schema.quotaLedger.reason, "render_reserved")),
        )
        .limit(1);
      if (reservation) {
        await transaction
          .insert(schema.quotaLedger)
          .values({
            ownerId: variant.ownerId,
            renderVariantId: variant.id,
            units: -1,
            reason: "technical_failure_credit",
            periodKey: reservation.periodKey,
          })
          .onConflictDoNothing();
      }
    });
    await notifyOwner(variant.ownerId, variant.id, "failed").catch((notificationError) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Render notification failed",
          renderId: id,
          code: (notificationError as Error).message,
        }),
      );
    });
    console.error(JSON.stringify({ level: "error", message: "Render failed", renderId: id, code }));
    captureException(error, { render_id: id, error_code: code });
    track("render_failed", variant.ownerId, { render_id: id, error_code: code, provider: provider.name });
  }
}

async function notifyOwner(ownerId: string, renderId: string, status: "succeeded" | "failed"): Promise<void> {
  const tokens = await db.select().from(schema.deviceTokens).where(eq(schema.deviceTokens.ownerId, ownerId));
  await Promise.all(
    tokens.map(async ({ token, environment }) => {
      const result = await push.send({
        token,
        environment: environment === "production" ? "production" : "sandbox",
        renderId,
        status,
      });
      if (result === "unregistered") await db.delete(schema.deviceTokens).where(eq(schema.deviceTokens.token, token));
    }),
  );
}

async function processCleanup(): Promise<void> {
  const [job] = await db.select().from(schema.cleanupJobs).where(isNull(schema.cleanupJobs.completedAt)).limit(1);
  if (!job) return;
  try {
    await storage.delete(job.storageKey);
    await db
      .update(schema.cleanupJobs)
      .set({ completedAt: new Date(), attemptCount: sql`${schema.cleanupJobs.attemptCount} + 1` })
      .where(eq(schema.cleanupJobs.id, job.id));
  } catch {
    await db
      .update(schema.cleanupJobs)
      .set({ attemptCount: sql`${schema.cleanupJobs.attemptCount} + 1` })
      .where(eq(schema.cleanupJobs.id, job.id));
  }
}

async function heartbeat(): Promise<void> {
  await db
    .insert(schema.workerHeartbeats)
    .values({ workerId, version: "1.0.0", lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: schema.workerHeartbeats.workerId,
      set: { version: "1.0.0", lastSeenAt: new Date() },
    });
}

async function pruneTransientSecurityData(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  await db.delete(schema.rateLimitWindows).where(lt(schema.rateLimitWindows.windowStart, cutoff));
  await db.delete(schema.appAttestChallenges).where(lt(schema.appAttestChallenges.expiresAt, new Date()));
}

console.log(JSON.stringify({ level: "info", message: "WearBloom worker starting", workerId, provider: provider.name }));
while (true) {
  await heartbeat();
  await processCleanup();
  if (Date.now() % 60_000 < 2_000) await pruneTransientSecurityData();
  const id = await claimRender();
  if (id) await processRender(id);
  else await Bun.sleep(1_500);
}
