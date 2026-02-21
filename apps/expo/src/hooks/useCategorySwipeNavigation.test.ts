import { describe, expect, test } from "bun:test";

import { shouldNavigateCategoryOnSwipe } from "./useCategorySwipeNavigation";

describe("shouldNavigateCategoryOnSwipe", () => {
  test("returns true for a strong horizontal swipe distance", () => {
    expect(shouldNavigateCategoryOnSwipe(-60, 10, 200)).toBe(true);
    expect(shouldNavigateCategoryOnSwipe(65, 8, 150)).toBe(true);
  });

  test("returns true for a fast horizontal swipe velocity", () => {
    expect(shouldNavigateCategoryOnSwipe(-18, 6, 880)).toBe(true);
    expect(shouldNavigateCategoryOnSwipe(12, 4, 760)).toBe(true);
  });

  test("returns false when vertical movement dominates", () => {
    expect(shouldNavigateCategoryOnSwipe(-50, 90, 500)).toBe(false);
    expect(shouldNavigateCategoryOnSwipe(40, 60, 1100)).toBe(false);
  });

  test("returns false for low distance and low velocity", () => {
    expect(shouldNavigateCategoryOnSwipe(15, 6, 200)).toBe(false);
    expect(shouldNavigateCategoryOnSwipe(-20, 7, 250)).toBe(false);
  });
});
