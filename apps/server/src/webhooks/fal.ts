import { createHash } from "node:crypto";
import type http from "node:http";
import type { Logger } from "pino";

import type { db as _dbInstance } from "@acme/db/client";
import { createCreditService } from "@acme/api/services/creditService";
import { createSubscriptionManager } from "@acme/api/services/subscriptionManager";
import { eq } from "@acme/db";
import { tryOnRenders } from "@acme/db/schema";

const JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";
const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50 MB

interface FalWebhookDeps {
  db: typeof _dbInstance;
  imageStorage: {
    saveRenderResult(
      userId: string,
      renderId: string,
      imageData: Buffer,
      mimeType: string,
    ): Promise<string>;
  };
  logger: Logger;
}

interface JwksKey {
  x: string;
}

let cachedKeys: JwksKey[] | null = null;
let cacheTimestamp = 0;

async function getJwksKeys(
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<JwksKey[]> {
  const now = Date.now();
  if (cachedKeys && now - cacheTimestamp < 24 * 60 * 60 * 1000) {
    return cachedKeys;
  }
  const response = await fetchFn(JWKS_URL);
  const data = (await response.json()) as { keys: JwksKey[] };
  cachedKeys = data.keys;
  cacheTimestamp = now;
  return cachedKeys;
}

async function verifyFalWebhookSignature(
  requestId: string,
  userId: string,
  timestamp: string,
  signatureHex: string,
  rawBody: string,
  fetchFn?: typeof globalThis.fetch,
): Promise<boolean> {
  const sodium = (await import("libsodium-wrappers")).default;
  await sodium.ready;

  // Validate timestamp
  const timestampInt = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampInt) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // Construct signed message
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = [requestId, userId, timestamp, bodyHash].join("\n");
  const messageBytes = Buffer.from(message, "utf-8");
  const signatureBytes = Buffer.from(signatureHex, "hex");

  // Try each JWKS public key
  const keys = await getJwksKeys(fetchFn);
  for (const keyInfo of keys) {
    const publicKeyBytes = Buffer.from(keyInfo.x, "base64url");
    try {
      if (
        sodium.crypto_sign_verify_detached(
          signatureBytes,
          messageBytes,
          publicKeyBytes,
        )
      ) {
        return true;
      }
    } catch {
      // Invalid key format, try next
    }
  }
  return false;
}

interface FalWebhookPayload {
  request_id: string;
  status: "OK" | "ERROR";
  payload?: {
    images?: {
      url: string;
      content_type: string;
      width: number;
      height: number;
    }[];
    detail?: unknown;
  };
  error?: string;
}

export function createFalWebhookHandler(deps: FalWebhookDeps) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Read raw body with size limit
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of req) {
      const buf = Buffer.from(chunk as Buffer);
      totalSize += buf.length;
      if (totalSize > MAX_BODY_SIZE) {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        return;
      }
      chunks.push(buf);
    }
    const rawBody = Buffer.concat(chunks).toString("utf-8");

    // Extract headers
    const requestId = req.headers["x-fal-webhook-request-id"] as
      | string
      | undefined;
    const userId = req.headers["x-fal-webhook-user-id"] as string | undefined;
    const timestamp = req.headers["x-fal-webhook-timestamp"] as
      | string
      | undefined;
    const signature = req.headers["x-fal-webhook-signature"] as
      | string
      | undefined;

    if (!requestId || !userId || !timestamp || !signature) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing webhook headers" }));
      return;
    }

    // Verify signature
    const isValid = await verifyFalWebhookSignature(
      requestId,
      userId,
      timestamp,
      signature,
      rawBody,
    );

    if (!isValid) {
      deps.logger.warn({ requestId }, "Invalid fal.ai webhook signature");
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid signature" }));
      return;
    }

    // Parse payload
    let payload: FalWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as FalWebhookPayload;
    } catch {
      deps.logger.warn({ requestId }, "Failed to parse webhook body as JSON");
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // Find render record by jobId
    const renderResults = await deps.db
      .select()
      .from(tryOnRenders)
      .where(eq(tryOnRenders.jobId, payload.request_id))
      .limit(1);

    const render = renderResults[0] as
      | {
          id: string;
          userId: string;
          status: string;
        }
      | undefined;

    if (!render) {
      deps.logger.warn(
        { requestId: payload.request_id },
        "Render record not found for webhook",
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Idempotency check
    if (render.status === "completed" || render.status === "failed") {
      deps.logger.info(
        { renderId: render.id, status: render.status },
        "Render already in terminal state, skipping",
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (payload.status === "OK" && payload.payload?.images?.[0]) {
      const image = payload.payload.images[0];

      try {
        // Validate image URL domain to prevent SSRF
        const imageUrl = new URL(image.url);
        if (
          imageUrl.protocol !== "https:" ||
          !imageUrl.hostname.endsWith(".fal.media")
        ) {
          deps.logger.warn(
            { url: image.url, renderId: render.id },
            "Blocked image URL — domain not allowed",
          );
          throw new Error("Image URL domain not allowed");
        }

        // Download the result image with size check
        const imageResponse = await fetch(image.url);
        const contentLength = imageResponse.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
          deps.logger.warn(
            { url: image.url, contentLength, renderId: render.id },
            "Image too large",
          );
          throw new Error("Image exceeds maximum size");
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Save to disk
        const resultPath = await deps.imageStorage.saveRenderResult(
          render.userId,
          render.id,
          imageBuffer,
          image.content_type,
        );

        const subscriptionManager = createSubscriptionManager({ db: deps.db });
        const isSubscriber = await subscriptionManager.isSubscriber(
          render.userId,
        );
        const shouldConsumeCredit = !isSubscriber;

        await deps.db.transaction(async (tx) => {
          if (shouldConsumeCredit) {
            const creditService = createCreditService({ db: tx });
            const consumeResult = await creditService.consumeCredit(
              render.userId,
            );
            if (!consumeResult.success) {
              throw new Error("INSUFFICIENT_CREDITS");
            }
          }

          await tx
            .update(tryOnRenders)
            .set({
              status: "completed",
              resultPath,
              creditConsumed: shouldConsumeCredit,
            })
            .where(eq(tryOnRenders.id, render.id));
        });

        deps.logger.info(
          { renderId: render.id, resultPath },
          "Render completed successfully",
        );
      } catch (err) {
        const errorCode =
          err instanceof Error && err.message === "INSUFFICIENT_CREDITS"
            ? "INSUFFICIENT_CREDITS"
            : "RENDER_FAILED";
        deps.logger.error(
          { renderId: render.id, err },
          "Failed to process render result",
        );
        await deps.db
          .update(tryOnRenders)
          .set({ status: "failed", errorCode })
          .where(eq(tryOnRenders.id, render.id));
      }
    } else {
      // Error
      const errorMessage = payload.error ?? "Unknown error from fal.ai";
      deps.logger.error(
        { renderId: render.id, error: errorMessage },
        "Render failed via webhook",
      );
      await deps.db
        .update(tryOnRenders)
        .set({ status: "failed", errorCode: "RENDER_FAILED" })
        .where(eq(tryOnRenders.id, render.id));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  };
}

// Reset cache for testing
export function _resetJwksCache(): void {
  cachedKeys = null;
  cacheTimestamp = 0;
}
