import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

// Import the real implementation AFTER the module mock is in place
import { createBackgroundRemoval } from "./backgroundRemoval";

// ---------------------------------------------------------------------------
// Mock the Replicate SDK (third-party, acceptable for mock.module)
// mock.module is irreversible, so we use a shared mockRun that tests can
// reconfigure via mockImplementation / mockImplementationOnce.
// ---------------------------------------------------------------------------

const mockRun = mock<(...args: unknown[]) => Promise<unknown>>(() =>
  Promise.resolve("https://pbxt.replicate.delivery/output.png"),
);

void mock.module("replicate", () => ({
  default: class MockReplicate {
    constructor(_opts?: unknown) {}
    run = mockRun;
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
    // pino loggers also have these, but the implementation only uses info/error
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

describe("backgroundRemoval — createBackgroundRemoval", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    // Restore fetch spy so other tests are not affected
    fetchSpy?.mockRestore();
    // Reset the shared mockRun to default (success URL) for isolation
    mockRun.mockReset();
    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );
  });

  // -----------------------------------------------------------------------
  // 1. Success path
  // -----------------------------------------------------------------------
  test("success: returns Buffer from downloaded URL", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeInstanceOf(Buffer);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(PNG_BYTES.length);
    // Verify fetch was called with the URL returned by replicate.run
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchCallArgs = fetchSpy.mock.calls[0] as unknown[];
    expect(fetchCallArgs[0]).toBe("https://pbxt.replicate.delivery/output.png");
  });

  // -----------------------------------------------------------------------
  // 2. Non-string output from replicate.run
  // -----------------------------------------------------------------------
  test("returns null when replicate.run returns non-string output", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() => Promise.resolve(42));

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
    // fetch should NOT have been called since output was not a string
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 3. Fetch of output URL fails (non-ok response)
  // -----------------------------------------------------------------------
  test("returns null when fetch of output URL returns non-ok response", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("Not Found", { status: 404 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 4. replicate.run throws a generic error
  // -----------------------------------------------------------------------
  test("returns null when replicate.run throws an error", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.reject(new Error("Replicate API failure")),
    );

    // fetch should not be called if replicate.run throws
    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 5. AbortError (timeout) from replicate.run
  // -----------------------------------------------------------------------
  test("returns null on AbortError (timeout)", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockRun.mockImplementation(() => Promise.reject(abortError));

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
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );

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
  test("logs error with duration when replicate.run throws", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    const err = new Error("Something broke");
    mockRun.mockImplementation(() => Promise.reject(err));

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
      replicateApiToken: "test-token",
      logger,
    });

    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockRun.mockImplementation(() => Promise.reject(abortError));

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
  test("logs error when replicate.run returns non-string output", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() => Promise.resolve({ url: "something" }));

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
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );

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
      replicateApiToken: "test-token",
      // no logger
    });

    // Success path without logger
    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );
    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    const result = await service.removeBackground(Buffer.from("input-image"));
    expect(result).toBeInstanceOf(Buffer);

    // Error path without logger
    fetchSpy.mockRestore();
    mockRun.mockImplementation(() => Promise.reject(new Error("fail")));
    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response("should not be called")),
    );

    const result2 = await service.removeBackground(Buffer.from("input-image"));
    expect(result2).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 9. Passes signal to replicate.run for abort support
  // -----------------------------------------------------------------------
  test("passes AbortController signal to replicate.run", async () => {
    const logger = createMockLogger();
    const service = createBackgroundRemoval({
      replicateApiToken: "test-token",
      logger,
    });

    mockRun.mockImplementation(() =>
      Promise.resolve("https://pbxt.replicate.delivery/output.png"),
    );

    fetchSpy = mockFetchImpl(() =>
      Promise.resolve(new Response(PNG_BYTES, { status: 200 })),
    );

    await service.removeBackground(Buffer.from("input-image"));

    // Verify replicate.run was called with signal in options
    expect(mockRun).toHaveBeenCalledTimes(1);
    const runArgs = mockRun.mock.calls[0]!;
    // First arg is the model identifier string
    expect(runArgs[0]).toBe(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
    );
    // Second arg is options object with input and signal
    const options = runArgs[1] as Record<string, unknown>;
    expect(options).toHaveProperty("input");
    expect(options).toHaveProperty("signal");
    expect((options.signal as AbortSignal).aborted).toBe(false);
  });
});
