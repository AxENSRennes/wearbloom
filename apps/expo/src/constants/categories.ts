/**
 * Garment categories — CLIENT-SIDE source of truth.
 * Must match: packages/db/src/schema.ts → GARMENT_CATEGORIES (pgEnum)
 * and packages/api/src/router/garment.ts → VALID_CATEGORIES.
 *
 * Duplicated here because @acme/db is a server-only package (Drizzle/postgres deps)
 * and cannot be imported in Expo client code.
 */
export const GARMENT_CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "shoes",
  "outerwear",
] as const;

export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const ALL_CATEGORIES = ["all", ...GARMENT_CATEGORIES] as const;

export type CategoryFilter = (typeof ALL_CATEGORIES)[number];
