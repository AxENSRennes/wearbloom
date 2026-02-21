import { Asset } from "expo-asset";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import * as formDataUtils from "./formData";
import * as imageCompressor from "./imageCompressor";
import { uploadStockBodyPhoto } from "./stockBodyPhotoUpload";

describe("uploadStockBodyPhoto", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns success when stock photo is processed and uploaded", async () => {
    const compressed = {
      uri: "file:///tmp/stock-body-compressed.jpg",
      width: 1200,
      height: 1600,
    } as Awaited<ReturnType<typeof imageCompressor.compressImage>>;

    spyOn(Asset, "fromModule").mockReturnValue({
      localUri: "file:///tmp/stock-body.jpg",
      uri: "file:///tmp/stock-body.jpg",
      downloadAsync: mock(() => Promise.resolve()),
    } as unknown as Asset);
    spyOn(imageCompressor, "compressImage").mockResolvedValue(compressed);
    spyOn(formDataUtils, "appendLocalImage").mockResolvedValue();

    const uploadBodyPhoto = mock(() => Promise.resolve({ imageId: "bp-1" }));

    const result = await uploadStockBodyPhoto({ uploadBodyPhoto });

    expect(result).toEqual({ success: true });
    expect(uploadBodyPhoto).toHaveBeenCalled();
  });

  test("returns asset_unavailable when stock asset cannot be resolved", async () => {
    spyOn(Asset, "fromModule").mockImplementation(() => {
      throw new Error("asset failure");
    });

    const result = await uploadStockBodyPhoto({
      uploadBodyPhoto: mock(() => Promise.resolve({ imageId: "bp-1" })),
    });

    expect(result).toEqual({ success: false, reason: "asset_unavailable" });
  });

  test("returns processing_failed when compression fails", async () => {
    spyOn(Asset, "fromModule").mockReturnValue({
      localUri: "file:///tmp/stock-body.jpg",
      uri: "file:///tmp/stock-body.jpg",
      downloadAsync: mock(() => Promise.resolve()),
    } as unknown as Asset);
    spyOn(imageCompressor, "compressImage").mockRejectedValue(
      new Error("compress failed"),
    );

    const result = await uploadStockBodyPhoto({
      uploadBodyPhoto: mock(() => Promise.resolve({ imageId: "bp-1" })),
    });

    expect(result).toEqual({ success: false, reason: "processing_failed" });
  });

  test("returns upload_failed when upload mutation fails", async () => {
    const compressed = {
      uri: "file:///tmp/stock-body-compressed.jpg",
      width: 1200,
      height: 1600,
    } as Awaited<ReturnType<typeof imageCompressor.compressImage>>;

    spyOn(Asset, "fromModule").mockReturnValue({
      localUri: "file:///tmp/stock-body.jpg",
      uri: "file:///tmp/stock-body.jpg",
      downloadAsync: mock(() => Promise.resolve()),
    } as unknown as Asset);
    spyOn(imageCompressor, "compressImage").mockResolvedValue(compressed);
    spyOn(formDataUtils, "appendLocalImage").mockResolvedValue();

    const result = await uploadStockBodyPhoto({
      uploadBodyPhoto: mock(() => Promise.reject(new Error("upload failed"))),
    });

    expect(result).toEqual({ success: false, reason: "upload_failed" });
  });
});
