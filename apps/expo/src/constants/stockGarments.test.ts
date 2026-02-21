import { describe, expect, test } from "bun:test";

import {
  getStockGarmentsByCategory,
  STOCK_BODY_PHOTO,
  STOCK_GARMENTS,
} from "./stockGarments";

describe("STOCK_GARMENTS", () => {
  test("has exactly 9 items", () => {
    expect(STOCK_GARMENTS).toHaveLength(9);
  });

  test("all stock garments have unique ids", () => {
    const ids = STOCK_GARMENTS.map((g) => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(STOCK_GARMENTS.length);
  });

  test("all ids start with 'stock-' prefix", () => {
    for (const garment of STOCK_GARMENTS) {
      expect(garment.id).toMatch(/^stock-/);
    }
  });

  test("categories include tops, bottoms, dresses, outerwear, and shoes", () => {
    const categories = new Set(STOCK_GARMENTS.map((g) => g.category));
    expect(categories.has("tops")).toBe(true);
    expect(categories.has("bottoms")).toBe(true);
    expect(categories.has("dresses")).toBe(true);
    expect(categories.has("outerwear")).toBe(true);
    expect(categories.has("shoes")).toBe(true);
  });

  test("all garments have isStock === true", () => {
    for (const garment of STOCK_GARMENTS) {
      expect(garment.isStock).toBe(true);
    }
  });

  test("all garments have a defined imageSource", () => {
    for (const garment of STOCK_GARMENTS) {
      expect(garment.imageSource).toBeDefined();
    }
  });

  test("all garments have a non-empty label", () => {
    for (const garment of STOCK_GARMENTS) {
      expect(garment.label).toEqual(expect.any(String));
      expect(garment.label.length).toBeGreaterThan(0);
    }
  });
});

describe("STOCK_BODY_PHOTO", () => {
  test("is defined", () => {
    expect(STOCK_BODY_PHOTO).toBeDefined();
  });
});

describe("getStockGarmentsByCategory", () => {
  test("returns only tops when filtering by 'tops'", () => {
    const tops = getStockGarmentsByCategory("tops");
    expect(tops.length).toBeGreaterThan(0);
    for (const g of tops) {
      expect(g.category).toBe("tops");
    }
  });

  test("returns only bottoms when filtering by 'bottoms'", () => {
    const bottoms = getStockGarmentsByCategory("bottoms");
    expect(bottoms.length).toBeGreaterThan(0);
    for (const g of bottoms) {
      expect(g.category).toBe("bottoms");
    }
  });

  test("returns all garments when category is 'all'", () => {
    const all = getStockGarmentsByCategory("all");
    expect(all).toHaveLength(STOCK_GARMENTS.length);
  });

  test("returns all garments when category is undefined", () => {
    const all = getStockGarmentsByCategory(undefined);
    expect(all).toHaveLength(STOCK_GARMENTS.length);
  });

  test("returns 1 shoe for shoes category", () => {
    const shoes = getStockGarmentsByCategory("shoes");
    expect(shoes).toHaveLength(1);
  });

  test("returns correct count for each category", () => {
    expect(getStockGarmentsByCategory("tops")).toHaveLength(3);
    expect(getStockGarmentsByCategory("bottoms")).toHaveLength(2);
    expect(getStockGarmentsByCategory("dresses")).toHaveLength(2);
    expect(getStockGarmentsByCategory("outerwear")).toHaveLength(1);
    expect(getStockGarmentsByCategory("shoes")).toHaveLength(1);
  });
});
