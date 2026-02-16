import type {
  GarmentCategory,
  RenderOptions,
  TryOnProvider,
  TryOnProviderConfig,
  TryOnResult,
} from "../tryOnProvider";

import type { FalClient } from "./falFashn";

export class FalNanoBananaProvider implements TryOnProvider {
  readonly name = "fal_nano_banana" as const;
  readonly supportedCategories: GarmentCategory[] = [
    "tops",
    "bottoms",
    "dresses",
  ];

  private readonly falClient: FalClient;
  private readonly webhookUrl: string;
  private readonly modelId: string;

  constructor(
    config: TryOnProviderConfig,
    falClient?: FalClient,
  ) {
    this.webhookUrl = config.webhookUrl;
    this.modelId = config.nanoBananaModelId;

    if (falClient) {
      this.falClient = falClient;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { fal } = require("@fal-ai/client") as { fal: FalClient };
      this.falClient = fal;
    }

    this.falClient.config({ credentials: config.falKey });
  }

  async submitRender(
    personImage: string | Buffer,
    garmentImage: string | Buffer,
    options?: RenderOptions,
  ): Promise<{ jobId: string }> {
    if (!this.modelId) {
      throw new Error(
        "FalNanoBananaProvider: FAL_NANO_BANANA_MODEL_ID is not configured",
      );
    }

    const personImageUrl = await this.uploadImage(personImage);
    const garmentImageUrl = await this.uploadImage(garmentImage);

    const result = await this.falClient.queue.submit(this.modelId, {
      input: {
        model_image: personImageUrl,
        garment_image: garmentImageUrl,
        category: options?.category ?? "auto",
        mode: options?.mode ?? "balanced",
      },
      webhookUrl: this.webhookUrl,
    });

    return { jobId: result.request_id };
  }

  async getResult(jobId: string): Promise<TryOnResult | null> {
    if (!this.modelId) return null;
    try {
      const result = await this.falClient.queue.result(this.modelId, {
        requestId: jobId,
      });
      const image = result.images[0];
      if (!image) return null;
      return {
        imageUrl: image.url,
        contentType: image.content_type,
        width: image.width,
        height: image.height,
      };
    } catch {
      return null;
    }
  }

  private async uploadImage(image: string | Buffer): Promise<string> {
    if (typeof image === "string") {
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(image);
      const blob = new Blob([buffer], { type: "image/jpeg" });
      return this.falClient.storage.upload(blob);
    }
    const blob = new Blob([image], { type: "image/jpeg" });
    return this.falClient.storage.upload(blob);
  }
}
