import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { GARMENT_CATEGORIES, type Category } from "../domain/categories";

export type Detection = { category: Category; confidence: number; model: string };

const detectionSchema = z.object({
  category: z.enum(GARMENT_CATEGORIES),
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
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Classify the main garment. If several garments are visible, classify the most prominent one. Confidence must be between 0 and 1.",
            },
            { type: "input_image", image_url: `data:${contentType};base64,${base64}`, detail: "low" },
          ],
        },
      ],
      text: { format: zodTextFormat(detectionSchema, "garment_detection") },
    });
    const parsed = response.output_parsed;
    if (!parsed) throw new Error("GARMENT_DETECTION_REFUSED");
    return { ...parsed, model: this.model };
  }
}
