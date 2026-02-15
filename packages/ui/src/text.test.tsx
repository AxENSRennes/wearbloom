import { describe, expect, test } from "bun:test";

import { themedTextStyle, ThemedText } from "./text";

describe("themedTextStyle", () => {
  test("display variant contains text-[28px]", () => {
    const result = themedTextStyle({ variant: "display" });
    expect(result).toContain("text-[28px]");
  });

  test("heading variant contains text-[22px]", () => {
    const result = themedTextStyle({ variant: "heading" });
    expect(result).toContain("text-[22px]");
  });

  test("title variant contains text-[17px] and font-semibold", () => {
    const result = themedTextStyle({ variant: "title" });
    expect(result).toContain("text-[17px]");
    expect(result).toContain("font-semibold");
  });

  test("body variant contains text-[15px]", () => {
    const result = themedTextStyle({ variant: "body" });
    expect(result).toContain("text-[15px]");
  });

  test("caption variant contains text-[13px] and font-medium", () => {
    const result = themedTextStyle({ variant: "caption" });
    expect(result).toContain("text-[13px]");
    expect(result).toContain("font-medium");
  });

  test("small variant contains text-[11px] and font-semibold", () => {
    const result = themedTextStyle({ variant: "small" });
    expect(result).toContain("text-[11px]");
    expect(result).toContain("font-semibold");
  });

  test("default (empty object) uses body variant", () => {
    const result = themedTextStyle({});
    expect(result).toContain("text-[15px]");
  });
});

describe("themedTextStyle base", () => {
  test("all variants include text-text-primary semantic token", () => {
    const variants = [
      "display",
      "heading",
      "title",
      "body",
      "caption",
      "small",
    ] as const;

    for (const variant of variants) {
      const result = themedTextStyle({ variant });
      expect(result).toContain("text-text-primary");
    }
  });

  test("default (no variant) includes text-text-primary", () => {
    const result = themedTextStyle({});
    expect(result).toContain("text-text-primary");
  });
});

describe("ThemedText", () => {
  test("is exported as a function", () => {
    expect(typeof ThemedText).toBe("function");
  });
});
