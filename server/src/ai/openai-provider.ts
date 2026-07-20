import OpenAI, { toFile } from "openai";
import type { GenerationInput, GenerationOutput, ImageGenerationProvider } from "./provider";

export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly name = "openai";

  constructor(readonly model: string, private readonly client: OpenAI) {}

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    const images = [
      await toFile(input.reference.bytes, "person.jpg", { type: input.reference.contentType }),
      ...await Promise.all(input.garments.map((item, index) =>
        toFile(item.bytes, `garment-${index}.jpg`, { type: item.contentType })
      )),
    ];
    const garmentList = input.garments.map((item) => `${item.category}: ${item.name}`).join(", ");
    const response = await this.client.images.edit({
      model: this.model,
      image: images,
      prompt: [
        "Create a premium vertical fashion editorial image of the person in the first reference image wearing the supplied garments.",
        `Garments: ${garmentList}.`,
        "Preserve the person's recognizable identity, proportions, pose plausibility, and skin tone. Show one coherent complete outfit.",
        "Do not add text, logos, accessories, or extra garments. This is style inspiration, not an exact fit prediction.",
        `Prompt version: ${input.promptVersion}.`,
      ].join(" "),
      size: input.size as "1024x1024" | "1024x1536" | "1536x1024" | "auto",
      quality: "high",
      input_fidelity: "high",
      output_format: "png",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("IMAGE_PROVIDER_EMPTY_RESULT");
    return { bytes: Uint8Array.fromBase64(encoded), contentType: "image/png" };
  }
}
