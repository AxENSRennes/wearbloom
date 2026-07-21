export type GarmentInput = { category: string; name: string; bytes: Uint8Array; contentType: string };
export type GenerationInput = {
  reference: { bytes: Uint8Array; contentType: string };
  garments: GarmentInput[];
  promptVersion: string;
  size: string;
};
export type GenerationOutput = {
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg";
  providerRequestId?: string;
};

export interface ImageGenerationProvider {
  readonly name: string;
  readonly model: string;
  generate(input: GenerationInput): Promise<GenerationOutput>;
}
