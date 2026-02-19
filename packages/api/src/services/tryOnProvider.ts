import type {
  GarmentCategory,
  RenderMode,
  TryOnProviderName,
} from "@acme/validators";

import { FalFashnProvider } from "./providers/falFashn";
import { FalNanoBananaProvider } from "./providers/falNanoBanana";
import { GoogleVTOProvider } from "./providers/googleVTO";

export interface RenderOptions {
  category?: GarmentCategory;
  mode?: RenderMode;
}

export type { GarmentCategory, TryOnProviderName };

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
  readonly name: TryOnProviderName;
  readonly supportedCategories: readonly GarmentCategory[];
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
  providerName: TryOnProviderName,
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
      throw new Error("Unknown provider");
  }
}
