import { describe, expect, test } from "bun:test";

import { createTryOnProvider } from "./tryOnProvider";

describe("createTryOnProvider", () => {
  const baseConfig = {
    falKey: "test-key",
    webhookUrl: "https://test.com/webhook",
    nanoBananaModelId: "test-model-id",
    googleCloudProject: "test-project",
    googleCloudRegion: "us-central1",
    googleAccessToken: "",
    renderTimeoutMs: 30000,
  };

  test("returns FalFashnProvider for 'fal_fashn'", () => {
    const provider = createTryOnProvider("fal_fashn", baseConfig);
    expect(provider.name).toBe("fal_fashn");
  });

  test("returns FalNanoBananaProvider for 'fal_nano_banana'", () => {
    const provider = createTryOnProvider("fal_nano_banana", baseConfig);
    expect(provider.name).toBe("fal_nano_banana");
  });

  test("returns GoogleVTOProvider for 'google_vto'", () => {
    const provider = createTryOnProvider("google_vto", baseConfig);
    expect(provider.name).toBe("google_vto");
  });

  test("throws for unknown provider", () => {
    expect(() => createTryOnProvider("unknown" as never, baseConfig)).toThrow(
      "Unknown provider",
    );
  });
});
