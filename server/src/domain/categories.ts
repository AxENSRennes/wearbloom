import { z } from "@hono/zod-openapi";

export const GARMENT_CATEGORIES = ["top", "bottom", "dress", "outerwear"] as const;

export const categorySchema = z.enum(GARMENT_CATEGORIES).openapi("GarmentCategory");

export type Category = (typeof GARMENT_CATEGORIES)[number];
