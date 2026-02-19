import type { GarmentCategory } from "@acme/validators";
import { GARMENT_CATEGORIES } from "@acme/validators";

export const ALL_CATEGORIES = ["all", ...GARMENT_CATEGORIES] as const;

export type CategoryFilter = (typeof ALL_CATEGORIES)[number];

export function isGarmentCategory(value: string): value is GarmentCategory {
  return GARMENT_CATEGORIES.includes(value as GarmentCategory);
}

export { GARMENT_CATEGORIES, type GarmentCategory };
