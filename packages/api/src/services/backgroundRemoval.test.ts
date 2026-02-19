import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

// Import the real implementation AFTER the module mock is in place
import { createBackgroundRemoval } from "./backgroundRemoval";

// ---------------------------------------------------------------------------
// Mock the @fal-ai/client SDK (third-party, acceptable for mock.module)
// mock.module is irreversible, so we use shared mocks that tests can
// reconfigure via mockImplementation / mockImplementationOnce.
// ---------------------------------------------------------------------------

const mockUpload = mock<(...args: unknown[]) => Promise<string>>(() =>
  Promise.resolve("https://fal.storage/uploaded-image.png"),
);

const mockSubscribe = mock<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve({
    data: {
      image: {
        url: "https://fal.run/output.png",
        content_type: "image/png",
        width: 512,
        height: 512,
      },
    },
  }),
);

const mockConfig = mock(() => {});

void mock.module("@fal-ai/client", () => ({
  fal: {
    config: mockConfig,
    storage: {
      upload: mockUpload,
    },
    subscribe: mockSubscribe,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
    fatal: mock(() => {}),
    trace: mock(() => {}),
    child: mock(() => createMockLogger()),
  } as unknown as Parameters<typeof createBackgroundRemoval>[0]["logger"];
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

// Helper: Bun's fetch type includes a `preconnect` property that test mocks don't need
function mockFetchImpl(impl: () => Promise<Response>) {
  return spyOn(globalThis, "fetch").mockImplementation(
    impl as unknown as typeof fetch,
  );
}

describe("backgroundRemoval — createBackgroundRemoval (fal.ai)", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    // Restore fetch spy so other tests are not affected
    fetchSpy?.mockRestore();
    // Reset shared mocks to default for isolation
    mockUpload.mockReset();
    mockUpload.mockImplementation(() =>
      Promise.resolve("https://fal.storage/uploaded-image.png"),
    );
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(() =>
      Promise.resolve({
        data: {
          image: {
            url: "https://fal.run/output.png",
            content_type: "image/png",
            width: 512,
            height: 512,
          },
        },
      }),
    );
    mockConfig.mockReset();
  });

  // -----------------------------------------------------------------------
  // 1. Success path
  // -----------------------------------------------------------------------
  test("success: returns Buffer from downloaded URL", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeInstanceOf(Buffer);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(PNG_BYTES.length);
    // Verify fal.storage.upload was called
    expect(mockUpload).toHaveBeenCalledTimes(1);
    // Verify fal.subscribe was called with the right model
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    const subscribeArgs = mockSubscribe.mock.calls[0]!;
    expect(subscribeArgs[0]).toBe("fal-ai/rmbg-v2");
    // Verify fetch was called with the output URL
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchCallArgs = fetchSpy.mock.calls[0] as unknown[];
    expect(fetchCallArgs[0]).toBe("https://fal.run/output.png");
  });

  // -----------------------------------------------------------------------
  // 2. Non-string output from fal.subscribe (unexpected data shape)
  // -----------------------------------------------------------------------
  test("returns null when fal.subscribe returns unexpected output shape", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    mockSubscribe.mockImplementation(() =>
      Promise.resolve({ data: { result: 42 } }),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
    // fetch should NOT have been called since output had no image URL
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 3. Fetch of output URL fails (non-ok response)
  // -----------------------------------------------------------------------
  test("returns null when fetch of output URL returns non-ok response", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("Not Found", { status: 404 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 4. fal.subscribe throws a generic error
  // -----------------------------------------------------------------------
  test("returns null when fal.subscribe throws an error", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    mockSubscribe.mockImplementation(() =>
      Promise.reject(new Error("fal.ai API failure")),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 5. AbortError (timeout)
  // -----------------------------------------------------------------------
  test("returns null on AbortError (timeout)", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockSubscribe.mockImplementation(() => Promise.reject(abortError));

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 6. Logs on successful completion
  // -----------------------------------------------------------------------
  test("logs info with duration on success", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    await service.removeBackground(Buffer.from("input-image"));

    expect(logger!.info).toHaveBeenCalledTimes(1);
    const infoCall = (logger!.info as ReturnType<typeof mock>).mock
      .calls[0] as unknown[];
    // First arg should be an object with durationMs
    expect(infoCall[0]).toHaveProperty("durationMs");
    expect(typeof (infoCall[0] as Record<string, unknown>).durationMs).toBe(
      "number",
    );
    // Second arg should be the message string
    expect(infoCall[1]).toBe("Background removal completed successfully");
  });

  // -----------------------------------------------------------------------
  // 7. Logs error on generic error
  // -----------------------------------------------------------------------
  test("logs error with duration when fal.subscribe throws", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    const err = new Error("Something broke");
    mockSubscribe.mockImplementation(() => Promise.reject(err));

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    await service.removeBackground(Buffer.from("input-image"));

    expect(logger!.error).toHaveBeenCalledTimes(1);
    const errorCall = (logger!.error as ReturnType<typeof mock>).mock
      .calls[0] as unknown[];
    // First arg should contain err and durationMs
    expect(errorCall[0]).toHaveProperty("err");
    expect(errorCall[0]).toHaveProperty("durationMs");
    expect((errorCall[0] as Record<string, unknown>).err).toBe(err);
    // Second arg should be the message string
    expect(errorCall[1]).toBe("Background removal failed");
  });

  // -----------------------------------------------------------------------
  // 7b. Logs error on AbortError (timeout-specific message)
  // -----------------------------------------------------------------------
  test("logs timeout error when AbortError is thrown", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockSubscribe.mockImplementation(() => Promise.reject(abortError));

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    await service.removeBackground(Buffer.from("input-image"));

    expect(logger!.error).toHaveBeenCalledTimes(1);
    const errorCall = (logger!.error as ReturnType<typeof mock>).mock
      .calls[0] as unknown[];
    // First arg should have durationMs but NOT the err object (timeout path)
    expect(errorCall[0]).toHaveProperty("durationMs");
    expect(errorCall[0]).not.toHaveProperty("err");
    // Second arg should be the timeout-specific message
    expect(errorCall[1]).toBe("Background removal timed out");
  });

  // -----------------------------------------------------------------------
  // 7c. Logs error when output type is unexpected
  // -----------------------------------------------------------------------
  test("logs error when fal.subscribe returns unexpected output shape", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    mockSubscribe.mockImplementation(() =>
      Promise.resolve({ data: { url: "something" } }),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    await service.removeBackground(Buffer.from("input-image"));

    expect(logger!.error).toHaveBeenCalledTimes(1);
    const errorCall = (logger!.error as ReturnType<typeof mock>).mock
      .calls[0] as unknown[];
    // First arg should contain outputType
    expect(errorCall[0]).toHaveProperty("outputType");
    expect((errorCall[0] as Record<string, unknown>).outputType).toBe("object");
    // Second arg should be the message
    expect(errorCall[1]).toBe("Unexpected background removal output type");
  });

  // -----------------------------------------------------------------------
  // 7d. Logs error when fetch returns non-ok status
  // -----------------------------------------------------------------------
  test("logs error with status when fetch returns non-ok response", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      logger,
    });

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("Server Error", { status: 500 })),
    );

    await service.removeBackground(Buffer.from("input-image"));

    expect(logger!.error).toHaveBeenCalledTimes(1);
    const errorCall = (logger!.error as ReturnType<typeof mock>).mock
      .calls[0] as unknown[];
    // First arg should contain the HTTP status
    expect(errorCall[0]).toHaveProperty("status");
    expect((errorCall[0] as Record<string, unknown>).status).toBe(500);
    // Second arg should be the message
    expect(errorCall[1]).toBe("Failed to download background removal result");
  });

  // -----------------------------------------------------------------------
  // 8. Works without logger (no crash on optional logger)
  // -----------------------------------------------------------------------
  test("works without logger — no crash on any code path", async () => {
    const service = createBackgroundRemoval({
      falKey: "test-fal-key",
      // no logger
    });

    // Success path without logger
    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));
    expect(result).toBeInstanceOf(Buffer);

    // Error path without logger
    fetchSpy.mockRestore();
    mockSubscribe.mockImplementation(() => Promise.reject(new Error("fail")));
    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result2 = await service.removeBackground(Buffer.from("input-image"));
    expect(result2).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 9. Configures fal client with credentials
  // -----------------------------------------------------------------------
  test("configures fal client with the provided falKey", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      falKey: "my-secret-fal-key",
      logger,
    });

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    await service.removeBackground(Buffer.from("input-image"));

    // Verify fal.config was called with credentials
    expect(mockConfig).toHaveBeenCalledTimes(1);
    const configArgs = mockConfig.mock.calls[0] as unknown[];
    expect(configArgs[0]).toEqual({ credentials: "my-secret-fal-key" });
  });
});
