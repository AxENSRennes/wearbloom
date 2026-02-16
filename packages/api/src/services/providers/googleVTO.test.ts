import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { TryOnProviderConfig } from "../tryOnProvider";
import type { GoogleVTOFetcher } from "./googleVTO";
import { GoogleVTOProvider } from "./googleVTO";

const baseConfig: TryOnProviderConfig = {
  falKey: "",
  webhookUrl: "",
  nanoBananaModelId: "",
  googleCloudProject: "test-project",
  googleCloudRegion: "us-central1",
  googleAccessToken: "test-token",
  renderTimeoutMs: 30000,
};

const RESULT_BASE64 = Buffer.from("mock-result-image").toString("base64");

function createMockFetch(): GoogleVTOFetcher {
  return mock(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          predictions: [
            {
              bytesBase64Encoded: RESULT_BASE64,
              mimeType: "image/png",
            },
          ],
        }),
    } as Response),
  );
}

describe("GoogleVTOProvider", () => {
  let mockFetch: GoogleVTOFetcher;
  let provider: GoogleVTOProvider;

  beforeEach(() => {
    mockFetch = createMockFetch();
    provider = new GoogleVTOProvider(baseConfig, mockFetch);
  });

  test("name returns 'google_vto'", () => {
    expect(provider.name).toBe("google_vto");
  });

  test("supportedCategories includes tops, bottoms, shoes", () => {
    expect(provider.supportedCategories).toContain("tops");
    expect(provider.supportedCategories).toContain("bottoms");
    expect(provider.supportedCategories).toContain("shoes");
  });

  test("submitRender makes synchronous POST to Vertex AI endpoint", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    await provider.submitRender(personImage, garmentImage);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/publishers/google/models/virtual-try-on-001:predict",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
      }),
    );
  });

  test("submitRender includes Authorization header when googleAccessToken is set", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    await provider.submitRender(personImage, garmentImage);

    const callArgs = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = callArgs[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  test("submitRender omits Authorization header when googleAccessToken is empty", async () => {
    const noTokenConfig = { ...baseConfig, googleAccessToken: "" };
    const noTokenProvider = new GoogleVTOProvider(noTokenConfig, mockFetch);

    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    await noTokenProvider.submitRender(personImage, garmentImage);

    const callArgs = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = callArgs[1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  test("submitRender returns a synthetic jobId", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    const result = await provider.submitRender(personImage, garmentImage);

    expect(result.jobId).toBeDefined();
    expect(typeof result.jobId).toBe("string");
    expect(result.jobId.length).toBeGreaterThan(0);
  });

  test("submitRender stores result immediately (sync model)", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    const { jobId } = await provider.submitRender(personImage, garmentImage);
    const result = await provider.getResult(jobId);

    expect(result).not.toBeNull();
    expect(result?.contentType).toBe("image/png");
    expect(result?.imageData).toEqual(Buffer.from(RESULT_BASE64, "base64"));
  });

  test("getResult returns the stored result", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    const { jobId } = await provider.submitRender(personImage, garmentImage);
    const result = await provider.getResult(jobId);

    expect(result).not.toBeNull();
  });

  test("getResult returns null for unknown jobId", async () => {
    const result = await provider.getResult("unknown-job-id");

    expect(result).toBeNull();
  });

  test("submitRender throws if GOOGLE_CLOUD_PROJECT is not configured", async () => {
    const emptyConfig = { ...baseConfig, googleCloudProject: "" };
    const emptyProvider = new GoogleVTOProvider(emptyConfig, mockFetch);

    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    expect(
      emptyProvider.submitRender(personImage, garmentImage),
    ).rejects.toThrow("GOOGLE_CLOUD_PROJECT is not configured");
  });

  test("submitRender sends base64-encoded images in correct format", async () => {
    const personImage = Buffer.from("person-image");
    const garmentImage = Buffer.from("garment-image");

    await provider.submitRender(personImage, garmentImage);

    const callArgs = (mockFetch as ReturnType<typeof mock>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(callArgs[1].body as string) as {
      instances: {
        personImage: { image: { bytesBase64Encoded: string } };
        productImages: { image: { bytesBase64Encoded: string } }[];
      }[];
      parameters: { sampleCount: number };
    };

    expect(
      body.instances[0]?.personImage.image.bytesBase64Encoded,
    ).toBe(personImage.toString("base64"));
    expect(
      body.instances[0]?.productImages[0]?.image.bytesBase64Encoded,
    ).toBe(garmentImage.toString("base64"));
    expect(body.parameters.sampleCount).toBe(1);
  });
});
