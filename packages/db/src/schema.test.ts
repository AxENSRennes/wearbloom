import { describe, expect, test } from "bun:test";

import {
  BG_REMOVAL_STATUSES,
  GARMENT_CATEGORIES,
  bgRemovalStatusEnum,
  garmentCategory,
  garments,
} from "./schema";

describe("garments schema", () => {
  test("garments table export exists", () => {
    expect(garments).toBeDefined();
  });

  test("garmentCategory enum export exists", () => {
    expect(garmentCategory).toBeDefined();
  });

  test("garments table has expected columns", () => {
    const columnNames = Object.keys(garments);
    const expected = [
      "id",
      "userId",
      "category",
      "imagePath",
      "cutoutPath",
      "bgRemovalStatus",
      "mimeType",
      "width",
      "height",
      "fileSize",
      "createdAt",
      "updatedAt",
    ];
    for (const col of expected) {
      expect(columnNames).toContain(col);
    }
  });

  test("garmentCategory enum has 5 values", () => {
    expect(garmentCategory.enumValues).toEqual([
      "tops",
      "bottoms",
      "dresses",
      "shoes",
      "outerwear",
    ]);
  });

  test("GARMENT_CATEGORIES has correct values", () => {
    expect(GARMENT_CATEGORIES).toEqual(["tops", "bottoms", "dresses", "shoes", "outerwear"]);
  });

  test("bgRemovalStatusEnum has correct values", () => {
    expect(bgRemovalStatusEnum.enumValues).toEqual([
      "pending",
      "completed",
      "failed",
      "skipped",
    ]);
  });

  test("BG_REMOVAL_STATUSES has correct values", () => {
    expect(BG_REMOVAL_STATUSES).toEqual(["pending", "completed", "failed", "skipped"]);
  });
});
