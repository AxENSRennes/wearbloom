import type { Logger } from "pino";
import Replicate from "replicate";

export interface BackgroundRemoval {
  removeBackground(imageBuffer: Buffer): Promise<Buffer | null>;
}

interface BackgroundRemovalOptions {
  replicateApiToken: string;
  logger?: Logger;
}

const BG_REMOVAL_TIMEOUT_MS = 30_000;

export function createBackgroundRemoval({
  replicateApiToken,
  logger,
}: BackgroundRemovalOptions): BackgroundRemoval {
  const replicate = new Replicate({ auth: replicateApiToken });

  return {
    /**
     * Fire-and-forget background removal async task.
     *
     * This function sends the image to Replicate for background removal processing.
     * It runs with a timeout to prevent hanging requests. The removal happens
     * asynchronously in the background without blocking the response.
     *
     * Note: In the garment.ts router, this is called via fire-and-forget IIFE:
     *   void (async () => { const cutout = await bgRemoval.removeBackground(...); })()
     *
     * The client polls garment.getGarment to check bgRemovalStatus and retrieve
     * the cutout path when ready. Status values: "pending", "completed", "failed", "skipped".
     *
     * Limitation: If the server crashes during removal, the cutout will be lost
     * (acceptable for MVP). In production, consider a persistent job queue.
     */
    async removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        BG_REMOVAL_TIMEOUT_MS,
      );

      try {
        const output = await replicate.run(
          "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
          {
            input: { image: imageBuffer },
            signal: controller.signal,
          },
        );

        // Output is a URL string pointing to the result PNG
        if (typeof output !== "string") {
          logger?.error(
            { outputType: typeof output },
            "Unexpected background removal output type",
          );
          return null;
        }

        const fetchController = new AbortController();
        const fetchTimeout = setTimeout(
          () => fetchController.abort(),
          BG_REMOVAL_TIMEOUT_MS,
        );
        try {
          const response = await fetch(output, {
            signal: fetchController.signal,
          });
          if (!response.ok) {
            logger?.error(
              { status: response.status },
              "Failed to download background removal result",
            );
            return null;
          }

          const arrayBuffer = await response.arrayBuffer();
          logger?.info({ durationMs: Date.now() - start }, "Background removal completed successfully");
          return Buffer.from(arrayBuffer);
        } finally {
          clearTimeout(fetchTimeout);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger?.error({ durationMs: Date.now() - start }, "Background removal timed out");
        } else {
          logger?.error({ err, durationMs: Date.now() - start }, "Background removal failed");
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
