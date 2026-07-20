import { describe, expect, test } from "bun:test";
import { inspectImage } from "../src/images/metadata";

describe("image validation", () => {
  test("reads PNG dimensions from the header", () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47], 0);
    new DataView(bytes.buffer).setUint32(16, 1200);
    new DataView(bytes.buffer).setUint32(20, 1600);
    expect(inspectImage(bytes)).toEqual({ contentType: "image/png", width: 1200, height: 1600, extension: "png" });
  });

  test("rejects arbitrary bytes", () => {
    expect(() => inspectImage(new Uint8Array(32))).toThrow("UPLOAD_UNSUPPORTED_TYPE");
  });
});
