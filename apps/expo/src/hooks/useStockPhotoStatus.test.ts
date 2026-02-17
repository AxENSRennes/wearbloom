import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as rq from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useStockPhotoStatus } from "./useStockPhotoStatus";

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
});
