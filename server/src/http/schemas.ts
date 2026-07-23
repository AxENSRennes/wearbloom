import { z } from "@hono/zod-openapi";
import { categorySchema } from "../domain/categories";

export { categorySchema } from "../domain/categories";
export { renderResponseSchema as renderSchema } from "../domain/render-contract";

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

export const standardErrors = {
  400: { content: { "application/json": { schema: errorSchema } }, description: "Malformed request" },
  401: { content: { "application/json": { schema: errorSchema } }, description: "Authentication required" },
  403: { content: { "application/json": { schema: errorSchema } }, description: "Request integrity rejected" },
  422: { content: { "application/json": { schema: errorSchema } }, description: "Invalid business input" },
} as const;
