import { z } from "zod/v4";

export const creditBalanceSchema = z.object({
  totalGranted: z.number(),
  totalConsumed: z.number(),
  remaining: z.number(),
});

export const consumeCreditResultSchema = z.object({
  success: z.boolean(),
  remaining: z.number(),
});
