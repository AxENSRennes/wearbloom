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
  readonly name: string;
  readonly supportedCategories: GarmentCategory[];
}

export interface TryOnProviderConfig {
  falKey: string;
  webhookUrl: string;
  nanoBananaModelId: string;
  googleCloudProject: string;
  googleCloudRegion: string;
  renderTimeoutMs: number;
}

export function createTryOnProvider(
  providerName: string,
  config: TryOnProviderConfig,
): TryOnProvider {
  switch (providerName) {
    case "fal_fashn": {
      const { FalFashnProvider } = require("./providers/falFashn") as {
        FalFashnProvider: new (config: TryOnProviderConfig) => TryOnProvider;
      };
      return new FalFashnProvider(config);
    }
    case "fal_nano_banana": {
      const { FalNanoBananaProvider } =
        require("./providers/falNanoBanana") as {
          FalNanoBananaProvider: new (
            config: TryOnProviderConfig,
          ) => TryOnProvider;
        };
      return new FalNanoBananaProvider(config);
    }
    case "google_vto": {
      const { GoogleVTOProvider } = require("./providers/googleVTO") as {
        GoogleVTOProvider: new (config: TryOnProviderConfig) => TryOnProvider;
      };
      return new GoogleVTOProvider(config);
    }
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
