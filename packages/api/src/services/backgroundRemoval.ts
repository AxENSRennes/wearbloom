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
    async removeBackground(imageBuffer: Buffer): Promise<Buffer | null> {
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

        const response = await fetch(output);
        if (!response.ok) {
          logger?.error(
            { status: response.status },
            "Failed to download background removal result",
          );
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        logger?.info("Background removal completed successfully");
        return Buffer.from(arrayBuffer);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger?.error("Background removal timed out");
        } else {
          logger?.error({ err }, "Background removal failed");
        }
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
