import { z } from "zod/v4";

export const GARMENT_CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "shoes",
  "outerwear",
] as const;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const garmentCategorySchema = z.enum(GARMENT_CATEGORIES);

export const TRYON_PROVIDERS = [
  "fal_fashn",
  "fal_nano_banana",
  "google_vto",
] as const;

export type TryOnProviderName = (typeof TRYON_PROVIDERS)[number];

export const tryOnProviderNameSchema = z.enum(TRYON_PROVIDERS);

export const RENDER_MODES = ["performance", "balanced", "quality"] as const;

export type RenderMode = (typeof RENDER_MODES)[number];

export const renderModeSchema = z.enum(RENDER_MODES);

// === Subscription schemas ===

export const verifyPurchaseSchema = z.object({
  signedTransactionInfo: z.string(),
});

export const restorePurchasesSchema = z.object({
  signedTransactions: z.array(z.string()).max(50),
});
