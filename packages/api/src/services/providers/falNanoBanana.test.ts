import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { TryOnProviderConfig } from "../tryOnProvider";
import type { FalClient } from "./falFashn";
import { FalNanoBananaProvider } from "./falNanoBanana";

function createMockFalClient(): FalClient {
  return {
    config: mock(() => {}),
    queue: {
      submit: mock(() =>
        Promise.resolve({ request_id: "nano-request-id" }),
      ),
      result: mock(() =>
        Promise.resolve({
          images: [
            {
              url: "https://cdn.fal.media/nano-mock.png",
              content_type: "image/png",
              width: 864,
              height: 1296,
            },
          ],
        }),
      ),
    },
    storage: {
      upload: mock(() =>
        Promise.resolve("https://fal.media/mock-upload.jpg"),
      ),
    },
  };
}

const baseConfig: TryOnProviderConfig = {
  falKey: "test-key",
  webhookUrl: "https://test.com/webhook",
  nanoBananaModelId: "fal-ai/nano-banana/tryon/v1",
  googleCloudProject: "",
  googleCloudRegion: "us-central1",
  googleAccessToken: "",
  renderTimeoutMs: 30000,
};

describe("FalNanoBananaProvider", () => {
  let mockFalClient: FalClient;
  let provider: FalNanoBananaProvider;

  beforeEach(() => {
    mockFalClient = createMockFalClient();
    provider = new FalNanoBananaProvider(baseConfig, mockFalClient);
  });

  test("name returns 'fal_nano_banana'", () => {
    expect(provider.name).toBe("fal_nano_banana");
  });

  test("supportedCategories includes tops, bottoms, dresses", () => {
    expect(provider.supportedCategories).toContain("tops");
    expect(provider.supportedCategories).toContain("bottoms");
    expect(provider.supportedCategories).toContain("dresses");
  });

  test("submitRender calls fal.queue.submit with configurable model ID", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    await provider.submitRender(personImage, garmentImage, {
      category: "tops",
    });

    expect(mockFalClient.queue.submit).toHaveBeenCalledWith(
      "fal-ai/nano-banana/tryon/v1",
      expect.objectContaining({
        input: expect.objectContaining({
          model_image: "https://fal.media/mock-upload.jpg",
          garment_image: "https://fal.media/mock-upload.jpg",
          category: "tops",
        }),
        webhookUrl: "https://test.com/webhook",
      }),
    );
  });

  test("submitRender returns request_id as jobId", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    const result = await provider.submitRender(personImage, garmentImage);

    expect(result.jobId).toBe("nano-request-id");
  });

  test("submitRender throws if model ID is empty", async () => {
    const emptyModelConfig = { ...baseConfig, nanoBananaModelId: "" };
    const emptyProvider = new FalNanoBananaProvider(
      emptyModelConfig,
      mockFalClient,
    );

    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    expect(
      emptyProvider.submitRender(personImage, garmentImage),
    ).rejects.toThrow("FAL_NANO_BANANA_MODEL_ID is not configured");
  });

  test("getResult returns TryOnResult for completed job", async () => {
    const result = await provider.getResult("completed-job-id");

    expect(result).toEqual({
      imageUrl: "https://cdn.fal.media/nano-mock.png",
      contentType: "image/png",
      width: 864,
      height: 1296,
    });
  });

  test("getResult returns null for pending job", async () => {
    (mockFalClient.queue.result as ReturnType<typeof mock>).mockImplementation(
      () => Promise.reject(new Error("Job still pending")),
    );

    const result = await provider.getResult("pending-job-id");

    expect(result).toBeNull();
  });
});
