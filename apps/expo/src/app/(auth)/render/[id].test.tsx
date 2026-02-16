import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactQuery from "@tanstack/react-query";

import RenderScreen from "./[id]";

// ---------------------------------------------------------------------------
// Helper: override useQuery return value for a single test via spyOn
// ---------------------------------------------------------------------------
function stubUseQuery(overrides: {
  data?: unknown;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  error?: { message: string } | null;
}) {
  const spy = spyOn(reactQuery, "useQuery");
  spy.mockReturnValue({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    isPending: overrides.isPending ?? false,
    isFetching: false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: mock(() => Promise.resolve()),
  } as ReturnType<typeof reactQuery.useQuery>);
  return spy;
}

describe("RenderScreen", () => {
  afterEach(() => {
    mock.restore();
  });

  // -------------------------------------------------------------------------
  // 1. Module exports default component
  // -------------------------------------------------------------------------
  test("module exports default component", async () => {
    const mod = await import("./[id]");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 2. Component renders without crashing (loading/polling state)
  // -------------------------------------------------------------------------
  test("renders without crashing in loading state", () => {
    stubUseQuery({ isLoading: true, data: undefined });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 3. SafeAreaView is the root container
  // -------------------------------------------------------------------------
  test("renders SafeAreaView as root container", () => {
    stubUseQuery({ data: null });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("mock-SafeAreaView");
  });

  // -------------------------------------------------------------------------
  // 4. Loading/polling state shows ActivityIndicator and status message
  // -------------------------------------------------------------------------
  test("loading state shows ActivityIndicator and pending status message", () => {
    stubUseQuery({ data: null, isLoading: false });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Default status is "pending" when no data
    expect(html).toContain("mock-ActivityIndicator");
    expect(html).toContain("Creating your look...");
  });

  // -------------------------------------------------------------------------
  // 5. STATUS_MESSAGES has expected keys (pending, processing, submitting)
  // -------------------------------------------------------------------------
  test("shows processing message when status is processing", () => {
    stubUseQuery({
      data: { status: "processing", resultImageUrl: null, errorCode: null },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Almost there...");
  });

  test("shows submitting message when status is submitting", () => {
    stubUseQuery({
      data: { status: "submitting", resultImageUrl: null, errorCode: null },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Sending to AI...");
  });

  // -------------------------------------------------------------------------
  // 6. Completed state shows result image and back button
  // -------------------------------------------------------------------------
  test("completed state shows result image and back button", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render-123",
        errorCode: null,
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // ExpoImage component should be rendered for the result
    expect(html).toContain("mock-ExpoImage");
    // contentFit="contain" is set on the image
    expect(html).toContain('contentFit="contain"');
    // Back button present
    expect(html).toContain("Back to Wardrobe");
    // Should NOT show ActivityIndicator in completed state
    expect(html).not.toContain("mock-ActivityIndicator");
    // Should NOT show "Render Failed" heading
    expect(html).not.toContain("Render Failed");
  });

  // -------------------------------------------------------------------------
  // 7. Failed state shows error heading and back button
  // -------------------------------------------------------------------------
  test("failed state shows 'Render Failed' heading and back button", () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_FAILED",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Render Failed");
    expect(html).toContain("Something went wrong. Please try again.");
    expect(html).toContain("Back to Wardrobe");
    // Should NOT show ActivityIndicator
    expect(html).not.toContain("mock-ActivityIndicator");
  });

  // -------------------------------------------------------------------------
  // 8. Failed state with RENDER_TIMEOUT shows timeout-specific message
  // -------------------------------------------------------------------------
  test("failed state with RENDER_TIMEOUT shows timeout message", () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_TIMEOUT",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Render Failed");
    expect(html).toContain("The render took too long. Please try again.");
  });

  // -------------------------------------------------------------------------
  // 9. MAX_POLLS limit is enforced via refetchInterval
  // -------------------------------------------------------------------------
  test("refetchInterval stops after MAX_POLLS (15) polls", () => {
    const querySpy = stubUseQuery({ data: null });

    renderToStaticMarkup(<RenderScreen />);

    // Extract refetchInterval callback from useQuery options
    expect(querySpy).toHaveBeenCalled();
    const queryOpts = querySpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const refetchInterval = queryOpts.refetchInterval as (query: {
      state: { data?: { status?: string } };
    }) => number | false;
    expect(typeof refetchInterval).toBe("function");

    const mockQuery = { state: { data: { status: "processing" } } };

    // Should allow 15 polls
    for (let i = 0; i < 15; i++) {
      expect(refetchInterval(mockQuery)).toBe(2000);
    }
    // 16th poll should be stopped
    expect(refetchInterval(mockQuery)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 10. refetchInterval returns false on terminal statuses
  // -------------------------------------------------------------------------
  test("refetchInterval returns false for completed and failed statuses", () => {
    const querySpy = stubUseQuery({ data: null });

    renderToStaticMarkup(<RenderScreen />);

    const queryOpts = querySpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const refetchInterval = queryOpts.refetchInterval as (query: {
      state: { data?: { status?: string } };
    }) => number | false;

    expect(refetchInterval({ state: { data: { status: "completed" } } })).toBe(false);
    expect(refetchInterval({ state: { data: { status: "failed" } } })).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 11. Pending status fallback shows correct message
  // -------------------------------------------------------------------------
  test("unknown status falls back to default 'Creating your look...' message", () => {
    stubUseQuery({
      data: { status: "unknown-status", resultImageUrl: null, errorCode: null },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Unknown status should use the fallback message
    expect(html).toContain("Creating your look...");
    expect(html).toContain("mock-ActivityIndicator");
  });
});
