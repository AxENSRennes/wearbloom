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
    ): Promise<unknown>;
    result(modelId: string, opts: { requestId: string }): Promise<unknown>;
  };
  storage: {
    upload(blob: Blob): Promise<unknown>;
  };
}

export interface FalImage {
  url: string;
  content_type: string;
  width: number;
  height: number;
}

function isFalImage(value: unknown): value is FalImage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.url === "string" &&
    typeof record.content_type === "string" &&
    typeof record.width === "number" &&
    typeof record.height === "number"
  );
}

export function getFalRequestId(payload: unknown): string {
  if (typeof payload === "object" && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.request_id === "string") {
      return record.request_id;
    }
  }
  throw new Error("FAL_INVALID_SUBMIT_RESPONSE");
}

export function getFalFirstImage(payload: unknown): FalImage | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.images)) return null;
  const images = record.images as unknown[];

  const first = images[0];
  if (!isFalImage(first)) {
    return null;
  }

  return first;
}

export function getFalUploadUrl(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  throw new Error("FAL_INVALID_UPLOAD_RESPONSE");
}

export class FalFashnProvider implements TryOnProvider {
  readonly name = "fal_fashn" as const;
  readonly supportedCategories: GarmentCategory[] = [
    "tops",
    "bottoms",
    "dresses",
  ];

  private falClientInstance: FalClient | null;
  private falClientPromise: Promise<FalClient> | null = null;
  private readonly falKey: string;
  private readonly webhookUrl: string;

  constructor(config: TryOnProviderConfig, falClient?: FalClient) {
    this.webhookUrl = config.webhookUrl;
    this.falKey = config.falKey;

    if (falClient) {
      falClient.config({ credentials: config.falKey });
      this.falClientInstance = falClient;
    } else {
      this.falClientInstance = null;
    }
  }

  private getFalClient(): Promise<FalClient> {
    if (this.falClientInstance) {
      return Promise.resolve(this.falClientInstance);
    }
    const falClientPromise = (this.falClientPromise ??= import(
      "@fal-ai/client"
    ).then((mod) => {
      const client = mod.fal;
      client.config({ credentials: this.falKey });
      this.falClientInstance = client;
      return client;
    }));
    return falClientPromise;
  }

  async submitRender(
    personImage: string | Buffer,
    garmentImage: string | Buffer,
    options?: RenderOptions,
  ): Promise<{ jobId: string }> {
    const client = await this.getFalClient();
    const personImageUrl = await this.uploadImage(personImage);
    const garmentImageUrl = await this.uploadImage(garmentImage);

    const result = await client.queue.submit(MODEL_ID, {
      input: {
        model_image: personImageUrl,
        garment_image: garmentImageUrl,
        category: options?.category ?? "auto",
        mode: options?.mode ?? "balanced",
      },
      webhookUrl: this.webhookUrl,
    });

    return { jobId: getFalRequestId(result) };
  }

  async getResult(jobId: string): Promise<TryOnResult | null> {
    const client = await this.getFalClient();
    try {
      const result = await client.queue.result(MODEL_ID, {
        requestId: jobId,
      });
      const image = getFalFirstImage(result);
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
    const client = await this.getFalClient();
    if (typeof image === "string") {
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(image);
      const blob = new Blob([buffer], { type: "image/jpeg" });
      const upload = await client.storage.upload(blob);
      return getFalUploadUrl(upload);
    }
    const blob = new Blob([image], { type: "image/jpeg" });
    const upload = await client.storage.upload(blob);
    return getFalUploadUrl(upload);
  }
}
