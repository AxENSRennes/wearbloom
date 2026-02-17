import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useStockGarmentPreferences } from "./useStockGarmentPreferences";

interface TestComponentProps {
  onResult: (result: ReturnType<typeof useStockGarmentPreferences>) => void;
}

function TestComponent({ onResult }: TestComponentProps) {
  const result = useStockGarmentPreferences();
  onResult(result);
  return React.createElement("div", null, JSON.stringify(result));
}

describe("useStockGarmentPreferences", () => {
  afterEach(async () => {
    mock.restore();
    await AsyncStorage.clear();
  });

  test("returns default hiddenIds as empty array", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(captured?.hiddenIds).toEqual([]);
  });

  test("returns default showStock as true", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(captured?.showStock).toBe(true);
  });

  test("exposes hideGarment as a function", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(typeof captured?.hideGarment).toBe("function");
  });

  test("exposes unhideGarment as a function", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(typeof captured?.unhideGarment).toBe("function");
  });

  test("exposes toggleShowStock as a function", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(typeof captured?.toggleShowStock).toBe("function");
  });

  test("exposes unhideAll as a function", () => {
    let captured: ReturnType<typeof useStockGarmentPreferences> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(typeof captured?.unhideAll).toBe("function");
  });
});
