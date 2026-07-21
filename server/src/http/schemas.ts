import { z } from "@hono/zod-openapi";

export const errorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      requestId: z.string().uuid(),
    }),
  })
  .openapi("Error");

export const idSchema = z.string().uuid();
export const categorySchema = z.enum(["top", "bottom", "dress", "outerwear"]);

export const garmentInputSchema = z.object({
  id: idSchema,
  category: categorySchema,
});

export const lookSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    note: z.string(),
    garments: z.array(garmentInputSchema),
    updatedAt: z.string().datetime(),
  })
  .openapi("Look");

export const renderSchema = z
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

export const standardErrors = {
  401: { content: { "application/json": { schema: errorSchema } }, description: "Authentication required" },
  403: { content: { "application/json": { schema: errorSchema } }, description: "Request integrity rejected" },
  422: { content: { "application/json": { schema: errorSchema } }, description: "Invalid business input" },
} as const;
