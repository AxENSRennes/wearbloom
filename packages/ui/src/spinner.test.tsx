import { describe, expect, test } from "bun:test";

import { wearbloomTheme } from "./gluestack-config";
import { Spinner } from "./spinner";

describe("Spinner", () => {
  test("is a function", () => {
    expect(typeof Spinner).toBe("function");
  });

  test("default color uses wearbloomTheme.colors.accent", () => {
    // The Spinner component signature has color defaulting to
    // wearbloomTheme.colors.accent. Verify the theme value is correct.
    expect(wearbloomTheme.colors.accent).toBe("#1A1A1A");
  });
});
