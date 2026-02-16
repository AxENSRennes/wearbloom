import { describe, expect, test } from "bun:test";

import { garmentCategory, garments } from "./schema";

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
});
