import type { TRYON_PROVIDERS } from "@acme/db/schema";

import { FalFashnProvider } from "./providers/falFashn";
import { FalNanoBananaProvider } from "./providers/falNanoBanana";
import { GoogleVTOProvider } from "./providers/googleVTO";

export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "shoes"
  | "outerwear";

export interface RenderOptions {
  category?: string;
  mode?: "performance" | "balanced" | "quality";
}

export interface TryOnResult {
  imageUrl: string;
  imageData?: Buffer;
  contentType: string;
  width?: number;
  height?: number;
}

export interface TryOnProvider {
  submitRender(
    personImage: string | Buffer,
    garmentImage: string | Buffer,
    options?: RenderOptions,
  ): Promise<{ jobId: string }>;
  getResult(jobId: string): Promise<TryOnResult | null>;
  readonly name: (typeof TRYON_PROVIDERS)[number];
  readonly supportedCategories: GarmentCategory[];
}

export interface TryOnProviderConfig {
  falKey: string;
  webhookUrl: string;
  nanoBananaModelId: string;
  googleCloudProject: string;
  googleCloudRegion: string;
  googleAccessToken: string;
  renderTimeoutMs: number;
}

export function createTryOnProvider(
  providerName: (typeof TRYON_PROVIDERS)[number],
  config: TryOnProviderConfig,
): TryOnProvider {
  switch (providerName) {
    case "fal_fashn":
      return new FalFashnProvider(config);
    case "fal_nano_banana":
      return new FalNanoBananaProvider(config);
    case "google_vto":
      return new GoogleVTOProvider(config);
    default:
      throw new Error(`Unknown provider: ${providerName as string}`);
  }
}
