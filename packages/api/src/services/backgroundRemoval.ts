import type { Logger } from "pino";

export interface BackgroundRemoval {
  removeBackground(imageBuffer: Buffer): Promise<Buffer | null>;
}

interface FalClient {
  config(opts: { credentials: string }): void;
  storage: {
    upload(blob: Blob): Promise<string>;
  };
  subscribe(
    modelId: string,
    opts: { input: Record<string, unknown> },
  ): Promise<{ data: unknown }>;
}

interface BackgroundRemovalOptions {
  falKey: string;
  logger?: Logger;
}

const BG_REMOVAL_TIMEOUT_MS = 30_000;
const MAX_CUTOUT_SIZE = 20 * 1024 * 1024; // 20 MB

export function createBackgroundRemoval({
  falKey,
  logger,
}: BackgroundRemovalOptions): BackgroundRemoval {
  // Lazy-import @fal-ai/client — same pattern as falFashn.ts
  let falClientInstance: FalClient | null = null;
  let falClientPromise: Promise<FalClient> | null = null;

  function getFalClient() {
    if (falClientInstance) {
      return Promise.resolve(falClientInstance);
    }
    const promise = (falClientPromise ??= import("@fal-ai/client").then(
      (mod) => {
        const client = mod.fal;
        client.config({ credentials: falKey });
        falClientInstance = client;
        return client;
      },
    ));
    return promise;
  }

  return {
    async removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        BG_REMOVAL_TIMEOUT_MS,
      );

      try {
        const fal = await getFalClient();

        // Upload buffer to fal storage
        const blob = new Blob([imageBuffer]);
        const uploadedUrl = await fal.storage.upload(blob);

        // Call Bria RMBG v2
        const result = await fal.subscribe("fal-ai/rmbg-v2", {
          input: { image_url: uploadedUrl },
        });

        // Extract image URL from result
        const imageUrl = (
          result.data as { image?: { url?: string } } | null | undefined
        )?.image?.url;

        if (typeof imageUrl !== "string") {
          logger?.error(
            { outputType: typeof result.data },
            "Unexpected background removal output type",
          );
          return null;
        }

        // Download the result PNG
        const fetchController = new AbortController();
        const fetchTimeout = setTimeout(
          () => fetchController.abort(),
          BG_REMOVAL_TIMEOUT_MS,
        );
        try {
          const response = await fetch(imageUrl, {
            signal: fetchController.signal,
          });

          const contentLength = response.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > MAX_CUTOUT_SIZE) {
            logger?.warn(
              { url: imageUrl, contentLength },
              "Background removal result too large",
            );
            return null;
          }
          if (!response.ok) {
            logger?.error(
              { status: response.status },
              "Failed to download background removal result",
            );
            return null;
          }

          const arrayBuffer = await response.arrayBuffer();
          logger?.info(
            { durationMs: Date.now() - start },
            "Background removal completed successfully",
          );
          return Buffer.from(arrayBuffer);
        } finally {
          clearTimeout(fetchTimeout);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger?.error(
            { durationMs: Date.now() - start },
            "Background removal timed out",
          );
        } else {
          logger?.error(
            { err, durationMs: Date.now() - start },
            "Background removal failed",
          );
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
