import { describe, expect, test } from "bun:test";

import { STOCK_BODY_PHOTO, STOCK_GARMENTS } from "./stockAssets";

describe("stockAssets", () => {
  test("STOCK_BODY_PHOTO is defined", () => {
    expect(STOCK_BODY_PHOTO).toBeDefined();
  });

  test("STOCK_GARMENTS has 6-8 items", () => {
    expect(STOCK_GARMENTS.length).toBeGreaterThanOrEqual(6);
    expect(STOCK_GARMENTS.length).toBeLessThanOrEqual(8);
  });

  test("each garment has required fields", () => {
    for (const garment of STOCK_GARMENTS) {
      expect(garment.id).toEqual(expect.any(String));
      expect(garment.source).toBeDefined();
      expect(garment.category).toEqual(expect.any(String));
      expect(garment.label).toEqual(expect.any(String));
    }
  });

  test("garment IDs are unique", () => {
    const ids = STOCK_GARMENTS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("garments cover multiple categories", () => {
    const categories = new Set(STOCK_GARMENTS.map((g) => g.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  test("valid categories only", () => {
    const validCategories = new Set([
      "tops",
      "bottoms",
      "dresses",
      "outerwear",
      "shoes",
    ]);
    for (const garment of STOCK_GARMENTS) {
      expect(validCategories.has(garment.category)).toBe(true);
    }
  });
});
