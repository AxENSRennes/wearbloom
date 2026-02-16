import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactQuery from "@tanstack/react-query";

import { useTryOnRender } from "./useTryOnRender";

// ---------------------------------------------------------------------------
// Helper: spy on useQuery to return custom data for a single test
// ---------------------------------------------------------------------------
function stubUseQuery(overrides: {
  data?: unknown;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
}) {
  const spy = spyOn(reactQuery, "useQuery");
  spy.mockReturnValue({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    isPending: overrides.isPending ?? false,
    isFetching: false,
    isError: overrides.isError ?? false,
    error: null,
    refetch: mock(() => Promise.resolve()),
  } as ReturnType<typeof reactQuery.useQuery>);
  return spy;
}

// ---------------------------------------------------------------------------
// Helper: render hook inside a minimal wrapper that serialises its return
// value as JSON inside a <script> tag, which we can parse from the SSR HTML.
// ---------------------------------------------------------------------------
function renderHookSSR(): Record<string, unknown> {
  function Wrapper() {
    const result = useTryOnRender();
    return React.createElement(
      "script",
      { type: "application/json", "data-testid": "hook-output" },
      JSON.stringify(result, (_key, value) =>
        typeof value === "function" ? "__fn__" : value,
      ),
    );
  }

  const html = renderToStaticMarkup(React.createElement(Wrapper));
  const jsonMatch = html.match(
    /<script[^>]*data-testid="hook-output"[^>]*>(.*?)<\/script>/,
  );
  if (!jsonMatch?.[1]) throw new Error("Could not extract hook output");
  return JSON.parse(jsonMatch[1]) as Record<string, unknown>;
}

describe("useTryOnRender", () => {
  afterEach(() => {
    mock.restore();
  });

  // -------------------------------------------------------------------------
  // 1. Module exports the hook function
  // -------------------------------------------------------------------------
  test("exports useTryOnRender function", async () => {
    const mod = await import("./useTryOnRender");
    expect(typeof mod.useTryOnRender).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 2. MAX_POLLS constant is 15 (verify via source — module-level constant)
  // -------------------------------------------------------------------------
  test("MAX_POLLS constant is 15", async () => {
    // MAX_POLLS is not exported, so we verify it by reading the source.
    // The refetchInterval callback checks `pollCount.current >= MAX_POLLS`.
    // We can verify the behavior by inspecting the useQuery call arg.
    const querySpy = spyOn(reactQuery, "useQuery");
    querySpy.mockReturnValue({
      data: null,
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mock(() => Promise.resolve()),
    } as ReturnType<typeof reactQuery.useQuery>);

    renderHookSSR();

    // Extract the refetchInterval function passed to useQuery
    expect(querySpy).toHaveBeenCalled();
    const queryOpts = querySpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const refetchInterval = queryOpts.refetchInterval as (query: {
      state: { data?: { status?: string } };
    }) => number | false;
    expect(typeof refetchInterval).toBe("function");

    // Simulate 15 polls (should return 2000 each time), then the 16th should return false
    const mockQuery = { state: { data: { status: "processing" } } };
    for (let i = 0; i < 15; i++) {
      // The function increments pollCount.current internally via ref
      // On SSR the ref starts at 0, so first 15 calls should succeed
      const result = refetchInterval(mockQuery);
      // First call: pollCount=0 < 15, increment to 1, return 2000
      // ...
      // 15th call: pollCount=14 < 15, increment to 15, return 2000
      expect(result).toBe(2000);
    }
    // 16th call: pollCount=15 >= 15, return false
    expect(refetchInterval(mockQuery)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Hook returns expected keys
  // -------------------------------------------------------------------------
  test("hook returns object with all expected keys", () => {
    stubUseQuery({ data: null });

    const result = renderHookSSR();

    expect(result).toHaveProperty("startRender");
    expect(result).toHaveProperty("reset");
    expect(result).toHaveProperty("renderId");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("resultImageUrl");
    expect(result).toHaveProperty("errorCode");
    expect(result).toHaveProperty("isPending");
    expect(result).toHaveProperty("isPolling");
  });

  // -------------------------------------------------------------------------
  // 4. startRender and reset are functions
  // -------------------------------------------------------------------------
  test("startRender and reset are functions", () => {
    stubUseQuery({ data: null });

    const result = renderHookSSR();

    // Functions are serialised as "__fn__" by our JSON replacer
    expect(result.startRender).toBe("__fn__");
    expect(result.reset).toBe("__fn__");
  });

  // -------------------------------------------------------------------------
  // 5. Initial state values are correct
  // -------------------------------------------------------------------------
  test("initial state has null renderId, null status, and isPending false", () => {
    stubUseQuery({ data: null });

    const result = renderHookSSR();

    expect(result.renderId).toBeNull();
    expect(result.resultImageUrl).toBeNull();
    expect(result.errorCode).toBeNull();
    expect(result.isPending).toBe(false);
    expect(result.isPolling).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 6. status falls back to "submitting" when mutation is pending
  // -------------------------------------------------------------------------
  test("status is 'submitting' when mutation isPending", () => {
    stubUseQuery({ data: null });

    const mutationSpy = spyOn(reactQuery, "useMutation");
    mutationSpy.mockReturnValue({
      mutate: mock(() => {}),
      mutateAsync: mock(() => Promise.resolve()),
      isPending: true,
      isError: false,
      error: null,
      data: null,
    } as unknown as ReturnType<typeof reactQuery.useMutation>);

    const result = renderHookSSR();

    expect(result.status).toBe("submitting");
    expect(result.isPending).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. status reflects query data status when available
  // -------------------------------------------------------------------------
  test("status reflects query data when statusQuery has data", () => {
    stubUseQuery({ data: { status: "completed", resultImageUrl: "/img/1.jpg", errorCode: null } });

    const result = renderHookSSR();

    expect(result.status).toBe("completed");
    expect(result.resultImageUrl).toBe("/img/1.jpg");
  });

  // -------------------------------------------------------------------------
  // 8. refetchInterval stops on terminal statuses
  // -------------------------------------------------------------------------
  test("refetchInterval returns false for completed status", () => {
    const querySpy = spyOn(reactQuery, "useQuery");
    querySpy.mockReturnValue({
      data: null,
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mock(() => Promise.resolve()),
    } as ReturnType<typeof reactQuery.useQuery>);

    renderHookSSR();

    const queryOpts = querySpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const refetchInterval = queryOpts.refetchInterval as (query: {
      state: { data?: { status?: string } };
    }) => number | false;

    expect(refetchInterval({ state: { data: { status: "completed" } } })).toBe(false);
    expect(refetchInterval({ state: { data: { status: "failed" } } })).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 9. errorCode is surfaced from query data
  // -------------------------------------------------------------------------
  test("errorCode is surfaced from query data", () => {
    stubUseQuery({
      data: { status: "failed", resultImageUrl: null, errorCode: "RENDER_TIMEOUT" },
    });

    const result = renderHookSSR();

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("RENDER_TIMEOUT");
    expect(result.isPolling).toBe(false);
  });
});
