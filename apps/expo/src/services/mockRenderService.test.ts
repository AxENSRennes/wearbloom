import { describe, expect, test } from "bun:test";

import { mockRequestRender } from "./mockRenderService";

describe("mockRenderService", () => {
  test("returns result after delay", async () => {
    const start = Date.now();
    const result = await mockRequestRender("body-photo-uri", "garment-uri");
    const elapsed = Date.now() - start;

    expect(result.resultUri).toBe("body-photo-uri");
    // Should take at least 3s (mock delay)
    expect(elapsed).toBeGreaterThanOrEqual(2900);
  });

  test("returns valid URI string", async () => {
    const result = await mockRequestRender("file:///test.jpg", "garment-123");
    expect(typeof result.resultUri).toBe("string");
    expect(result.resultUri.length).toBeGreaterThan(0);
  });

  test("accepts two string parameters and returns {resultUri} shape", async () => {
    const result = await mockRequestRender("body-uri", "garment-uri");
    // Verify the return shape has exactly the expected key
    expect(result).toHaveProperty("resultUri");
    expect(Object.keys(result)).toEqual(["resultUri"]);
  });
});
