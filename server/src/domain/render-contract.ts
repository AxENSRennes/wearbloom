import { z } from "@hono/zod-openapi";
import { categorySchema } from "./categories";

const idSchema = z.string().uuid();

export const renderInputSnapshotSchema = z.object({
  look: z.object({
    id: idSchema,
    name: z.string(),
  }),
  garments: z.array(
    z.object({
      id: idSchema,
      category: categorySchema,
      name: z.string(),
      assetId: idSchema.nullable(),
    }),
  ),
  referencePhotoId: idSchema,
});

export type RenderInputSnapshot = z.infer<typeof renderInputSnapshotSchema>;

export const renderResponseSchema = z
  .object({
    id: idSchema,
    lookId: idSchema,
    status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]),
    resultURL: z.string().nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .openapi("RenderVariant");

export type RenderResponse = z.infer<typeof renderResponseSchema>;
