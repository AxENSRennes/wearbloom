import type { GenerationInput, GenerationOutput, ImageGenerationProvider } from "./provider";

export class StubImageProvider implements ImageGenerationProvider {
  readonly name = "stub";
  readonly model = "reference-pass-through";

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    return {
      bytes: input.reference.bytes,
      contentType: input.reference.contentType === "image/png" ? "image/png" : "image/jpeg",
      providerRequestId: `stub_${crypto.randomUUID()}`,
    };
  }
}
