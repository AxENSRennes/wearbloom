import { describe, expect, test } from "bun:test";

import { ThemedPressable } from "./pressable";

describe("ThemedPressable", () => {
  test("is exported as a valid React component", () => {
    // forwardRef returns an object with $$typeof and render function
    expect(ThemedPressable).toBeDefined();
    expect(typeof ThemedPressable).toBe("object");
    expect(
      typeof (ThemedPressable as unknown as { render: unknown }).render,
    ).toBe("function");
  });

  test('displayName is "ThemedPressable"', () => {
    expect(ThemedPressable.displayName).toBe("ThemedPressable");
  });
});
