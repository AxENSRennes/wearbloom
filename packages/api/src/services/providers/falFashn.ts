import type {
  GarmentCategory,
  RenderOptions,
  TryOnProvider,
  TryOnProviderConfig,
  TryOnResult,
} from "../tryOnProvider";

const MODEL_ID = "fal-ai/fashn/tryon/v1.6";

export interface FalClient {
  config(opts: { credentials: string }): void;
  queue: {
    submit(
      modelId: string,
      opts: {
        input: Record<string, unknown>;
        webhookUrl?: string;
      },
    ): Promise<{ request_id: string }>;
    result(
      modelId: string,
      opts: { requestId: string },
    ): Promise<{
      images: {
        url: string;
        content_type: string;
        width: number;
        height: number;
      }[];
    }>;
  };
  storage: {
    upload(blob: Blob): Promise<string>;
  };
}

export class FalFashnProvider implements TryOnProvider {
  readonly name = "fal_fashn" as const;
  readonly supportedCategories: GarmentCategory[] = [
    "tops",
    "bottoms",
    "dresses",
  ];

  private readonly falClient: FalClient;
  private readonly webhookUrl: string;

  constructor(
    config: TryOnProviderConfig,
    falClient?: FalClient,
  ) {
    this.webhookUrl = config.webhookUrl;

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
    const personImageUrl = await this.uploadImage(personImage);
    const garmentImageUrl = await this.uploadImage(garmentImage);

    const result = await this.falClient.queue.submit(MODEL_ID, {
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
    try {
      const result = await this.falClient.queue.result(MODEL_ID, {
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
      // Read file from disk
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(image);
      const blob = new Blob([buffer], { type: "image/jpeg" });
      return this.falClient.storage.upload(blob);
    }
    const blob = new Blob([image], { type: "image/jpeg" });
    return this.falClient.storage.upload(blob);
  }
}
