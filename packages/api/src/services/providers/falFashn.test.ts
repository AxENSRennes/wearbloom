import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { TryOnProviderConfig } from "../tryOnProvider";
import type { FalClient } from "./falFashn";
import { FalFashnProvider } from "./falFashn";

function createMockFalClient(): FalClient {
  return {
    config: mock(() => {}),
    queue: {
      submit: mock(() =>
        Promise.resolve({ request_id: "mock-request-id" }),
      ),
      result: mock(() =>
        Promise.resolve({
          images: [
            {
              url: "https://cdn.fal.media/mock.png",
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
  nanoBananaModelId: "",
  googleCloudProject: "",
  googleCloudRegion: "us-central1",
  googleAccessToken: "",
  renderTimeoutMs: 30000,
};

describe("FalFashnProvider", () => {
  let mockFalClient: FalClient;
  let provider: FalFashnProvider;

  beforeEach(() => {
    mockFalClient = createMockFalClient();
    provider = new FalFashnProvider(baseConfig, mockFalClient);
  });

  afterEach(() => {
    mock.restore();
  });

  test("name returns 'fal_fashn'", () => {
    expect(provider.name).toBe("fal_fashn");
  });

  test("supportedCategories includes tops, bottoms, dresses", () => {
    expect(provider.supportedCategories).toContain("tops");
    expect(provider.supportedCategories).toContain("bottoms");
    expect(provider.supportedCategories).toContain("dresses");
  });

  test("submitRender uploads images to fal.ai storage before submitting", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    await provider.submitRender(personImage, garmentImage);

    expect(mockFalClient.storage.upload).toHaveBeenCalledTimes(2);
  });

  test("submitRender calls fal.queue.submit with correct model ID and input", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    await provider.submitRender(personImage, garmentImage, {
      category: "tops",
    });

    expect(mockFalClient.queue.submit).toHaveBeenCalledWith(
      "fal-ai/fashn/tryon/v1.6",
      expect.objectContaining({
        input: expect.objectContaining({
          model_image: "https://fal.media/mock-upload.jpg",
          garment_image: "https://fal.media/mock-upload.jpg",
          category: "tops",
          mode: "balanced",
        }),
        webhookUrl: "https://test.com/webhook",
      }),
    );
  });

  test("submitRender includes webhookUrl in submit options", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    await provider.submitRender(personImage, garmentImage);

    expect(mockFalClient.queue.submit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        webhookUrl: "https://test.com/webhook",
      }),
    );
  });

  test("submitRender returns request_id as jobId", async () => {
    const personImage = Buffer.from("person-image-data");
    const garmentImage = Buffer.from("garment-image-data");

    const result = await provider.submitRender(personImage, garmentImage);

    expect(result.jobId).toBe("mock-request-id");
  });

  test("getResult returns null for pending job", async () => {
    (mockFalClient.queue.result as ReturnType<typeof mock>).mockImplementation(
      () => Promise.reject(new Error("Job still pending")),
    );

    const result = await provider.getResult("pending-job-id");

    expect(result).toBeNull();
  });

  test("getResult returns TryOnResult for completed job", async () => {
    const result = await provider.getResult("completed-job-id");

    expect(result).toEqual({
      imageUrl: "https://cdn.fal.media/mock.png",
      contentType: "image/png",
      width: 864,
      height: 1296,
    });
  });
});
