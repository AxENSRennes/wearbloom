import { describe, expect, test } from "bun:test";

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { compressImage } from "./imageCompressor";

describe("compressImage", () => {
  test("calls manipulateAsync with correct resize, format and compress params", async () => {
    const result = await compressImage("file:///original/photo.jpg");

    expect(manipulateAsync).toHaveBeenCalledWith(
      "file:///original/photo.jpg",
      [{ resize: { width: 1200 } }],
      { format: SaveFormat.JPEG, compress: 0.8 },
    );
    expect(result).toEqual({
      uri: "file:///mock/compressed.jpg",
      width: 1200,
      height: 1600,
    });
  });

  test("returns the result from manipulateAsync", async () => {
    const result = await compressImage("file:///another/image.png");

    expect(result).toHaveProperty("uri");
    expect(result).toHaveProperty("width");
    expect(result).toHaveProperty("height");
  });
});
