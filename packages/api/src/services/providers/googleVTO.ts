import { createId } from "@paralleldrive/cuid2";

import type {
  GarmentCategory,
  RenderOptions,
  TryOnProvider,
  TryOnProviderConfig,
  TryOnResult,
} from "../tryOnProvider";

export type GoogleVTOFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export class GoogleVTOProvider implements TryOnProvider {
  readonly name = "google_vto" as const;
  readonly supportedCategories: GarmentCategory[] = [
    "tops",
    "bottoms",
    "shoes",
  ];

  private readonly googleCloudProject: string;
  private readonly googleCloudRegion: string;
  private readonly googleAccessToken: string;
  private readonly fetchFn: GoogleVTOFetcher;
  private readonly resultStore = new Map<string, TryOnResult>();

  constructor(config: TryOnProviderConfig, fetchFn?: GoogleVTOFetcher) {
    this.googleCloudProject = config.googleCloudProject;
    this.googleCloudRegion = config.googleCloudRegion;
    this.googleAccessToken = config.googleAccessToken;
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  async submitRender(
    personImage: string | Buffer,
    garmentImage: string | Buffer,
    _options?: RenderOptions,
  ): Promise<{ jobId: string }> {
    if (!this.googleCloudProject) {
      throw new Error(
        "GoogleVTOProvider: GOOGLE_CLOUD_PROJECT is not configured",
      );
    }

    const personBase64 = await this.toBase64(personImage);
    const garmentBase64 = await this.toBase64(garmentImage);

    const endpoint = `https://${this.googleCloudRegion}-aiplatform.googleapis.com/v1/projects/${this.googleCloudProject}/locations/${this.googleCloudRegion}/publishers/google/models/virtual-try-on-001:predict`;

    const requestBody = {
      instances: [
        {
          personImage: { image: { bytesBase64Encoded: personBase64 } },
          productImages: [{ image: { bytesBase64Encoded: garmentBase64 } }],
        },
      ],
      parameters: { sampleCount: 1 },
    };

    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.googleAccessToken
          ? { Authorization: `Bearer ${this.googleAccessToken}` }
          : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Google VTO API error: ${String(response.status)} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      predictions: {
        bytesBase64Encoded: string;
        mimeType?: string;
      }[];
    };

    const prediction = data.predictions[0];
    if (!prediction) {
      throw new Error("Google VTO: No prediction returned");
    }

    const jobId = createId();
    const imageData = Buffer.from(prediction.bytesBase64Encoded, "base64");

    this.resultStore.set(jobId, {
      imageUrl: "",
      imageData,
      contentType: prediction.mimeType ?? "image/png",
    });

    // Auto-cleanup after 5 minutes to prevent memory leaks
    setTimeout(
      () => {
        this.resultStore.delete(jobId);
      },
      5 * 60 * 1000,
    );

    return { jobId };
  }

  getResult(jobId: string): Promise<TryOnResult | null> {
    return Promise.resolve(this.resultStore.get(jobId) ?? null);
  }

  private async toBase64(image: string | Buffer): Promise<string> {
    if (typeof image === "string") {
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(image);
      return buffer.toString("base64");
    }
    return image.toString("base64");
  }
}
