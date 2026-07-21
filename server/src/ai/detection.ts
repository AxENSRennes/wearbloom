import type OpenAI from "openai";
import { z } from "zod";
import type { Category } from "../domain/composition";

export type Detection = { category: Category; confidence: number; model: string };

const detectionSchema = z.object({
  category: z.enum(["top", "bottom", "dress", "outerwear"]),
  confidence: z.number().min(0).max(1),
});

export interface GarmentDetector {
  detect(bytes: Uint8Array, contentType: string): Promise<Detection>;
}

export class StubGarmentDetector implements GarmentDetector {
  async detect(): Promise<Detection> {
    return { category: "top", confidence: 0.5, model: "stub-needs-confirmation" };
  }
}

export class OpenAIGarmentDetector implements GarmentDetector {
  constructor(
    private readonly client: OpenAI,
    private readonly model = "gpt-5-mini",
  ) {}

  async detect(bytes: Uint8Array, contentType: string): Promise<Detection> {
    const base64 = Buffer.from(bytes).toString("base64");
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Classify the main garment as exactly one of: top, bottom, dress, outerwear. Return only compact JSON with category and confidence from 0 to 1.",
            },
            { type: "input_image", image_url: `data:${contentType};base64,${base64}`, detail: "low" },
          ],
        },
      ],
    });
    const parsed = detectionSchema.parse(JSON.parse(response.output_text));
    return { ...parsed, model: this.model };
  }
}
