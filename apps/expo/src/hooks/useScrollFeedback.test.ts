import { describe, expect, test } from "bun:test";

import {
  computeScrollState,
  resolveScrollEdge,
} from "~/hooks/useScrollFeedback";

describe("useScrollFeedback utilities", () => {
  test("returns non-scrollable state when content fits viewport", () => {
    const state = computeScrollState({
      offsetY: 0,
      contentHeight: 400,
      viewportHeight: 600,
    });

    expect(state.canScroll).toBe(false);
    expect(state.isAtTop).toBe(true);
    expect(state.isAtBottom).toBe(true);
    expect(state.offsetY).toBe(0);
  });

  test("returns middle state when offset is inside range", () => {
    const state = computeScrollState({
      offsetY: 120,
      contentHeight: 1200,
      viewportHeight: 600,
    });

    expect(state.canScroll).toBe(true);
    expect(state.isAtTop).toBe(false);
    expect(state.isAtBottom).toBe(false);
    expect(resolveScrollEdge(state)).toBe("none");
  });

  test("clamps offset at top and bottom boundaries", () => {
    const top = computeScrollState({
      offsetY: -30,
      contentHeight: 1200,
      viewportHeight: 600,
    });
    const bottom = computeScrollState({
      offsetY: 9999,
      contentHeight: 1200,
      viewportHeight: 600,
    });

    expect(top.offsetY).toBe(0);
    expect(top.isAtTop).toBe(true);
    expect(resolveScrollEdge(top)).toBe("top");

    expect(bottom.offsetY).toBe(600);
    expect(bottom.isAtBottom).toBe(true);
    expect(resolveScrollEdge(bottom)).toBe("bottom");
  });
});
