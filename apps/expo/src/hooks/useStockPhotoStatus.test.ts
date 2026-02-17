import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as rq from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useStockPhotoStatus } from "./useStockPhotoStatus";

/* ------------------------------------------------------------------ */
/* useState override via mock.module (irreversible, but transparent)   */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _useStateOverride: ((initial: unknown) => any) | null = null;

const OrigReact = await import("react");
// Capture the original useState reference BEFORE mock.module replaces it
const _origUseState = OrigReact.useState;

mock.module("react", () => {
  const wrapped = {
    ...OrigReact,
    // Override the named export
    useState: (...args: unknown[]) => {
      if (_useStateOverride) return _useStateOverride(args[0]);
      return _origUseState(...(args as [unknown]));
    },
  };
  // Also patch default.useState so React.useState works
  wrapped.default = {
    ...OrigReact.default,
    useState: wrapped.useState,
  };
  return wrapped;
});

/* ------------------------------------------------------------------ */

interface TestComponentProps {
  onResult: (result: ReturnType<typeof useStockPhotoStatus>) => void;
}

function TestComponent({ onResult }: TestComponentProps) {
  const result = useStockPhotoStatus();
  onResult(result);
  return React.createElement("div", null, JSON.stringify(result));
}

describe("useStockPhotoStatus", () => {
  afterEach(async () => {
    _useStateOverride = null;
    mock.restore();
    await AsyncStorage.clear();
  });

  test("returns isLoading: true and usedStockBodyPhoto: false initially (SSR)", () => {
    let captured: ReturnType<typeof useStockPhotoStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    // SSR cannot run useEffect, so isLoading should be true and usedStockBodyPhoto defaults false
    expect(captured?.isLoading).toBe(true);
    expect(captured?.usedStockBodyPhoto).toBe(false);
  });

  test("returns usedStockBodyPhoto: false when body photo exists in DB (regardless of source)", () => {
    const spy = spyOn(rq, "useQuery").mockReturnValue({
      data: { imageId: "photo-xyz", imageUrl: "/api/images/photo-xyz" },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({} as never),
    } as never);

    let captured: ReturnType<typeof useStockPhotoStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    // When DB photo exists, usedStockBodyPhoto is always false
    expect(captured?.usedStockBodyPhoto).toBe(false);

    spy.mockRestore();
  });

  test("returns usedStockBodyPhoto: false when source not set (non-onboarded user)", () => {
    // Default: no AsyncStorage value set, no DB photo
    let captured: ReturnType<typeof useStockPhotoStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    // Source not set, defaults to false
    expect(captured?.usedStockBodyPhoto).toBe(false);
  });

  test("exports hook as a function", () => {
    expect(typeof useStockPhotoStatus).toBe("function");
  });

  test("returns usedStockBodyPhoto: true when source is stock and no DB photo", () => {
    let useStateCallCount = 0;
    _useStateOverride = (initial: unknown) => {
      useStateCallCount++;
      // Call 1: source state - override to "stock"
      if (useStateCallCount === 1) return ["stock", mock(() => {})];
      // Call 2: sourceLoaded state - override to true
      if (useStateCallCount === 2) return [true, mock(() => {})];
      // Other useState calls (from other hooks): pass through
      return [initial, mock(() => {})];
    };

    let captured: ReturnType<typeof useStockPhotoStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );

    expect(captured?.usedStockBodyPhoto).toBe(true);
    expect(captured?.isLoading).toBe(false);
  });

  test("returns usedStockBodyPhoto: false when source is stock BUT DB photo exists", () => {
    let useStateCallCount = 0;
    _useStateOverride = (initial: unknown) => {
      useStateCallCount++;
      if (useStateCallCount === 1) return ["stock", mock(() => {})];
      if (useStateCallCount === 2) return [true, mock(() => {})];
      return [initial, mock(() => {})];
    };

    spyOn(rq, "useQuery").mockReturnValue({
      data: { imageId: "photo-xyz", imageUrl: "/api/images/photo-xyz" },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({} as never),
    } as never);

    let captured: ReturnType<typeof useStockPhotoStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );

    expect(captured?.usedStockBodyPhoto).toBe(false);
  });
});
