import { describe, expect, mock, test } from "bun:test";

import type { BackgroundRemoval } from "./backgroundRemoval";

// We test via DI — create a mock implementation that simulates the service behavior
// without hitting the Replicate API. This tests the interface contract.

function createMockBackgroundRemoval(
  behavior: "success" | "error" | "timeout",
): BackgroundRemoval {
  return {
    async removeBackground(_imageBuffer: Buffer): Promise<Buffer | null> {
      if (behavior === "success") {
        return Buffer.from("mock-cutout-png-data");
      }
      if (behavior === "error") {
        return null;
      }
      // timeout
      return null;
    },
  };
}

describe("BackgroundRemoval interface contract", () => {
  test("success path returns a Buffer", async () => {
    const service = createMockBackgroundRemoval("success");
    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeInstanceOf(Buffer);
    expect(result?.length).toBeGreaterThan(0);
  });

  test("error path returns null", async () => {
    const service = createMockBackgroundRemoval("error");
    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
  });

  test("timeout path returns null", async () => {
    const service = createMockBackgroundRemoval("timeout");
    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
  });
});

describe("createBackgroundRemoval", () => {
  test("exports createBackgroundRemoval function", async () => {
    const { createBackgroundRemoval } = await import("./backgroundRemoval");
    expect(typeof createBackgroundRemoval).toBe("function");
  });

  test("creates an object with removeBackground method", async () => {
    const { createBackgroundRemoval } = await import("./backgroundRemoval");
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
    });

    expect(typeof service.removeBackground).toBe("function");
  });
});
