import { describe, expect, test } from "bun:test";

import { Button, buttonStyle, buttonTextStyle, SPINNER_COLORS } from "./button";
import { wearbloomTheme } from "./gluestack-config";

// ---------------------------------------------------------------------------
// buttonStyle variants
// ---------------------------------------------------------------------------

describe("buttonStyle", () => {
  test("primary variant includes bg-accent and h-[52px]", () => {
    const cls = buttonStyle({ variant: "primary" });
    expect(cls).toContain("bg-accent");
    expect(cls).toContain("h-[52px]");
  });

  test("secondary variant includes bg-background, border-accent, and h-[52px]", () => {
    const cls = buttonStyle({ variant: "secondary" });
    expect(cls).toContain("bg-background");
    expect(cls).toContain("border-accent");
    expect(cls).toContain("h-[52px]");
  });

  test("ghost variant includes bg-transparent and h-[44px]", () => {
    const cls = buttonStyle({ variant: "ghost" });
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("h-[44px]");
  });

  test("isDisabled true includes opacity-40", () => {
    const cls = buttonStyle({ variant: "primary", isDisabled: true });
    expect(cls).toContain("opacity-40");
  });

  test("default variant (no args) returns primary style", () => {
    const cls = buttonStyle({});
    expect(cls).toContain("bg-accent");
    expect(cls).toContain("h-[52px]");
  });
});

// ---------------------------------------------------------------------------
// buttonTextStyle variants
// ---------------------------------------------------------------------------

describe("buttonTextStyle", () => {
  test("primary variant includes text-white", () => {
    const cls = buttonTextStyle({ variant: "primary" });
    expect(cls).toContain("text-white");
  });

  test("secondary variant includes text-[#1A1A1A]", () => {
    const cls = buttonTextStyle({ variant: "secondary" });
    expect(cls).toContain("text-[#1A1A1A]");
  });

  test("ghost variant includes text-text-secondary", () => {
    const cls = buttonTextStyle({ variant: "ghost" });
    expect(cls).toContain("text-text-secondary");
  });
});

// ---------------------------------------------------------------------------
// SPINNER_COLORS
// ---------------------------------------------------------------------------

describe("SPINNER_COLORS", () => {
  test("primary matches wearbloomTheme.colors.background", () => {
    expect(SPINNER_COLORS.primary).toBe(wearbloomTheme.colors.background);
  });

  test("secondary matches wearbloomTheme.colors.accent", () => {
    expect(SPINNER_COLORS.secondary).toBe(wearbloomTheme.colors.accent);
  });

  test("ghost matches wearbloomTheme.colors['text-secondary']", () => {
    expect(SPINNER_COLORS.ghost).toBe(wearbloomTheme.colors["text-secondary"]);
  });
});

// ---------------------------------------------------------------------------
// Button export smoke test
// ---------------------------------------------------------------------------

describe("Button", () => {
  test("is a function", () => {
    expect(typeof Button).toBe("function");
  });
});
