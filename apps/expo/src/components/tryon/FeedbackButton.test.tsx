import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from "bun:test";
import type { Root } from "react-dom/client";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import * as Haptics from "expo-haptics";

import { FeedbackButton } from "./FeedbackButton";

describe("FeedbackButton", () => {
  const defaultProps = {
    onSubmit: mock(() => {}),
    onDismiss: mock(() => {}),
    isSubmitting: false,
  };

  // -------------------------------------------------------------------------
  // 1. Renders collapsed state with MessageCircle icon
  // -------------------------------------------------------------------------
  test("renders collapsed state with feedback-button testID", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).toContain('testID="feedback-button"');
    expect(html).toContain('testID="feedback-icon-collapsed"');
  });

  // -------------------------------------------------------------------------
  // 2. Renders with correct size (44x44 touch target)
  // -------------------------------------------------------------------------
  test("renders with 44x44 touch target dimensions", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    // Verify the outer pressable has width/height 44
    expect(html).toContain("width");
    expect(html).toContain("44");
  });

  // -------------------------------------------------------------------------
  // 3. Does NOT show thumbs icons in collapsed state
  // -------------------------------------------------------------------------
  test("does not show thumbs icons in collapsed state", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).not.toContain('testID="feedback-thumbs-up"');
    expect(html).not.toContain('testID="feedback-thumbs-down"');
  });

  // -------------------------------------------------------------------------
  // 4. Has accessibilityLabel "Rate this render"
  // -------------------------------------------------------------------------
  test('has accessibilityLabel "Rate this render"', () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).toContain("Rate this render");
  });

  // -------------------------------------------------------------------------
  // 5. Has accessibilityHint "Double tap to rate quality"
  // -------------------------------------------------------------------------
  test('has accessibilityHint "Double tap to rate quality"', () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).toContain("Double tap to rate quality");
  });

  // -------------------------------------------------------------------------
  // 6. Has accessibilityRole "button"
  // -------------------------------------------------------------------------
  test('has accessibilityRole "button"', () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).toContain("button");
  });

  // -------------------------------------------------------------------------
  // 7. Renders as a Pressable component (structural)
  // -------------------------------------------------------------------------
  test("renders as a Pressable component", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    // Should render a Pressable (mock-Pressable in our test setup)
    expect(html).toContain("mock-Pressable");
  });

  // -------------------------------------------------------------------------
  // 8. Exports FeedbackButton as named export
  // -------------------------------------------------------------------------
  test("exports FeedbackButton as named export", async () => {
    const mod = await import("./FeedbackButton");
    expect(mod.FeedbackButton).toBeDefined();
    expect(typeof mod.FeedbackButton).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 9. Uses 32px visible circle (borderRadius: 16)
  // -------------------------------------------------------------------------
  test("uses semi-transparent white background in collapsed state", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    // The collapsed state should have a 32px circle styling
    expect(html).toContain("32");
  });

  // -------------------------------------------------------------------------
  // 10. Props interface accepts onSubmit, onDismiss, isSubmitting
  // -------------------------------------------------------------------------
  test("accepts all required props without error", () => {
    const onSubmit = mock(() => {});
    const onDismiss = mock(() => {});

    const html = renderToStaticMarkup(
      <FeedbackButton
        onSubmit={onSubmit}
        onDismiss={onDismiss}
        isSubmitting={false}
      />,
    );

    expect(html).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // 11. Renders with isSubmitting=true (disabled state)
  // -------------------------------------------------------------------------
  test("renders with isSubmitting=true without crash", () => {
    const html = renderToStaticMarkup(
      <FeedbackButton {...defaultProps} isSubmitting={true} />,
    );

    expect(html).toContain('testID="feedback-button"');
  });

  // -------------------------------------------------------------------------
  // 12. Does not show category picker or checkmark in collapsed state
  // -------------------------------------------------------------------------
  test("does not show category picker or checkmark in collapsed state", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).not.toContain('testID="feedback-icon-confirmed"');
    expect(html).not.toContain('testID="category-wrong_fit"');
  });

  // -------------------------------------------------------------------------
  // 13. Contains the MessageCircle icon in collapsed state
  // -------------------------------------------------------------------------
  test("contains MessageCircle icon in collapsed state", () => {
    const html = renderToStaticMarkup(<FeedbackButton {...defaultProps} />);

    expect(html).toContain("Icon-MessageCircle");
  });
});

// =============================================================================
// Behavioral Tests — DOM rendering with interactions, timers, haptics
// =============================================================================

/**
 * Helper to get the React-internal props from a DOM element rendered by React.
 * React attaches a `__reactProps$<randomKey>` property to custom elements,
 * which contains the actual props (including function handlers like onPress).
 */
function getReactProps(el: Element): Record<string, unknown> {
  const propsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!propsKey) throw new Error("No React props found on element");
  return (el as unknown as Record<string, Record<string, unknown>>)[propsKey];
}

/**
 * Helper to query an element by testID within a container.
 * React lowercases custom element attribute names in the DOM, so
 * `testID="foo"` becomes `testid="foo"`.
 */
function queryByTestId(
  container: HTMLElement,
  testId: string,
): Element | null {
  return container.querySelector(`[testid="${testId}"]`);
}

/**
 * Simulate pressing a mock-Pressable by calling its onPress React prop.
 */
function pressElement(el: Element): void {
  const props = getReactProps(el);
  if (typeof props.onPress !== "function") {
    throw new Error(
      `Element <${el.tagName}> testid="${el.getAttribute("testid")}" has no onPress handler`,
    );
  }
  (props.onPress as () => void)();
}

/**
 * Find the first mock-Pressable element inside a container element.
 * In the collapsed state, the Pressable with onPress is nested inside
 * the outer Animated.View that carries testID="feedback-button".
 */
function findPressable(parent: Element): Element {
  const pressable = parent.querySelector("mock-pressable");
  if (!pressable) {
    throw new Error(
      `No mock-Pressable found inside <${parent.tagName}> testid="${parent.getAttribute("testid")}"`,
    );
  }
  return pressable;
}

describe("FeedbackButton -- Behavioral", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSubmit: ReturnType<typeof mock>;
  let onDismiss: ReturnType<typeof mock>;

  beforeEach(() => {
    jest.useFakeTimers();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    onSubmit = mock(() => {});
    onDismiss = mock(() => {});

    // Clear any previous call counts on haptics mocks
    (Haptics.impactAsync as ReturnType<typeof mock>).mockClear();
    (Haptics.notificationAsync as ReturnType<typeof mock>).mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
  });

  function renderButton(isSubmitting = false) {
    act(() => {
      root.render(
        <FeedbackButton
          onSubmit={onSubmit}
          onDismiss={onDismiss}
          isSubmitting={isSubmitting}
        />,
      );
    });
  }

  /** Press the collapsed state button. Finds the Pressable inside the outer wrapper. */
  function pressCollapsedButton() {
    const wrapper = queryByTestId(container, "feedback-button");
    expect(wrapper).not.toBeNull();
    const pressable = findPressable(wrapper!);
    pressElement(pressable);
  }

  // ---------------------------------------------------------------------------
  // 1. Expands to show thumbs up and thumbs down on press
  // ---------------------------------------------------------------------------
  test("expands to show thumbs up and thumbs down on press", () => {
    renderButton();

    // Collapsed -- no thumbs icons
    expect(queryByTestId(container, "feedback-thumbs-up")).toBeNull();
    expect(queryByTestId(container, "feedback-thumbs-down")).toBeNull();

    // Press to expand
    act(() => {
      pressCollapsedButton();
    });

    // Expanded -- thumbs icons visible
    expect(queryByTestId(container, "feedback-thumbs-up")).not.toBeNull();
    expect(queryByTestId(container, "feedback-thumbs-down")).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 2. Calls onSubmit with "thumbs_up" when thumbs up pressed
  // ---------------------------------------------------------------------------
  test('calls onSubmit with "thumbs_up" when thumbs up pressed', () => {
    renderButton();

    // Expand
    act(() => {
      pressCollapsedButton();
    });

    // Press thumbs up
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-up")!);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("thumbs_up", undefined);
  });

  // ---------------------------------------------------------------------------
  // 3. Thumbs-down shows category options before submitting
  // ---------------------------------------------------------------------------
  test("thumbs-down shows category options before submitting", () => {
    renderButton();

    // Expand
    act(() => {
      pressCollapsedButton();
    });

    // Press thumbs down
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });

    // Should NOT call onSubmit yet
    expect(onSubmit).not.toHaveBeenCalled();

    // Category buttons should be visible
    expect(queryByTestId(container, "category-wrong_fit")).not.toBeNull();
    expect(queryByTestId(container, "category-artifacts")).not.toBeNull();
    expect(queryByTestId(container, "category-wrong_garment")).not.toBeNull();
    expect(queryByTestId(container, "category-other")).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 4. Category options include "Wrong fit", "Artifacts", "Wrong garment", "Other"
  // ---------------------------------------------------------------------------
  test('category options include "Wrong fit", "Artifacts", "Wrong garment", "Other"', () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });

    // The four expected categories are rendered as Pressable elements
    const expectedCategories = [
      "category-wrong_fit",
      "category-artifacts",
      "category-wrong_garment",
      "category-other",
    ];

    for (const testId of expectedCategories) {
      expect(queryByTestId(container, testId)).not.toBeNull();
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Tapping a category submits feedback with category
  // ---------------------------------------------------------------------------
  test("tapping a category submits feedback with category", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });
    act(() => {
      pressElement(queryByTestId(container, "category-wrong_fit")!);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("thumbs_down", "wrong_fit");
  });

  // ---------------------------------------------------------------------------
  // 6. Calls onSubmit with "thumbs_down" + category for artifacts
  // ---------------------------------------------------------------------------
  test('calls onSubmit with "thumbs_down" + category for artifacts', () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });
    act(() => {
      pressElement(queryByTestId(container, "category-artifacts")!);
    });

    expect(onSubmit).toHaveBeenCalledWith("thumbs_down", "artifacts");
  });

  // ---------------------------------------------------------------------------
  // 7. Shows checkmark after thumbs up selection
  // ---------------------------------------------------------------------------
  test("shows checkmark after thumbs up selection", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-up")!);
    });

    // Confirmed state: check icon visible, thumbs gone
    expect(queryByTestId(container, "feedback-icon-confirmed")).not.toBeNull();
    expect(queryByTestId(container, "feedback-thumbs-up")).toBeNull();
    expect(queryByTestId(container, "feedback-thumbs-down")).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 8. Shows checkmark after category selection then calls onDismiss (800ms)
  // ---------------------------------------------------------------------------
  test("shows checkmark after category selection then calls onDismiss after 800ms", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });
    act(() => {
      pressElement(queryByTestId(container, "category-other")!);
    });

    // Confirmed state with checkmark
    expect(queryByTestId(container, "feedback-icon-confirmed")).not.toBeNull();

    // onDismiss not called yet
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance by 800ms (CONFIRM_DISMISS_MS)
    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 9. Calls onDismiss 800ms after thumbs up selection
  // ---------------------------------------------------------------------------
  test("calls onDismiss 800ms after thumbs up selection", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-up")!);
    });

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 10. Auto-hides after 10 seconds (calls onDismiss)
  // ---------------------------------------------------------------------------
  test("auto-hides after 10 seconds by calling onDismiss", () => {
    renderButton();

    // Not called initially
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance to just under 10s
    act(() => {
      jest.advanceTimersByTime(9999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance past 10s
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 11. Resets auto-hide timer on interaction (expand)
  // ---------------------------------------------------------------------------
  test("resets auto-hide timer when user expands", () => {
    renderButton();

    // Advance 7 seconds
    act(() => {
      jest.advanceTimersByTime(7000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Interact (expand) -- should reset the 10s timer
    act(() => {
      pressCollapsedButton();
    });

    // Advance another 7 seconds (total 14s from mount, but only 7s from last reset)
    act(() => {
      jest.advanceTimersByTime(7000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance past the reset timer (3 more seconds = 10s from expand)
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 12. Resets auto-hide timer on thumbs down interaction
  // ---------------------------------------------------------------------------
  test("resets auto-hide timer on thumbs down interaction", () => {
    renderButton();

    // Advance 9 seconds
    act(() => {
      jest.advanceTimersByTime(9000);
    });

    // Expand
    act(() => {
      pressCollapsedButton();
    });

    // Advance 9 seconds
    act(() => {
      jest.advanceTimersByTime(9000);
    });

    // Press thumbs down -- resets timer again
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });

    // Advance 9 seconds -- should still not dismiss
    act(() => {
      jest.advanceTimersByTime(9000);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance 1 more second -- now 10s from last interaction
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 13. Triggers light haptic on initial expand
  // ---------------------------------------------------------------------------
  test("triggers light haptic on initial expand", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  // ---------------------------------------------------------------------------
  // 14. Triggers notification haptic on feedback selection (thumbs up)
  // ---------------------------------------------------------------------------
  test("triggers success notification haptic on thumbs up selection", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-up")!);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  // ---------------------------------------------------------------------------
  // 15. Triggers notification haptic on category selection
  // ---------------------------------------------------------------------------
  test("triggers success notification haptic on category selection", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });
    act(() => {
      pressElement(queryByTestId(container, "category-wrong_garment")!);
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  // ---------------------------------------------------------------------------
  // 16. Respects Reduce Motion -- withSpring used when reducedMotion is false
  // ---------------------------------------------------------------------------
  test("uses withSpring animations when reducedMotion is false (default)", async () => {
    // The mock useReducedMotion returns false. When reducedMotion is false,
    // the component uses withSpring() for width transitions. We spy on
    // withSpring to verify it is called on expand, proving the animation
    // code path is taken (the opposite path — direct assignment — is taken
    // when reducedMotion is true).
    const reanimated = await import("react-native-reanimated");
    const withSpringSpy = spyOn(reanimated, "withSpring");

    renderButton();

    act(() => {
      pressCollapsedButton();
    });

    // withSpring should have been called with the EXPANDED_WIDTH (120)
    expect(withSpringSpy).toHaveBeenCalled();
    expect(withSpringSpy.mock.calls[0]?.[0]).toBe(120);

    withSpringSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // 17. Category picker dismisses on selection (transitions to confirmed)
  // ---------------------------------------------------------------------------
  test("category picker dismisses on selection and transitions to confirmed", () => {
    renderButton();

    act(() => {
      pressCollapsedButton();
    });
    act(() => {
      pressElement(queryByTestId(container, "feedback-thumbs-down")!);
    });

    // Category picker visible
    expect(queryByTestId(container, "category-wrong_fit")).not.toBeNull();

    act(() => {
      pressElement(queryByTestId(container, "category-wrong_fit")!);
    });

    // Category picker gone, checkmark shown
    expect(queryByTestId(container, "category-wrong_fit")).toBeNull();
    expect(queryByTestId(container, "feedback-icon-confirmed")).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 18. Does not expand when isSubmitting is true
  // ---------------------------------------------------------------------------
  test("does not expand when isSubmitting is true", () => {
    renderButton(true);

    const wrapper = queryByTestId(container, "feedback-button");
    expect(wrapper).not.toBeNull();

    // The inner Pressable should have disabled=true
    const pressable = findPressable(wrapper!);
    const props = getReactProps(pressable);
    expect(props.disabled).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 19. Does not call onSubmit when isSubmitting during thumbs up
  // ---------------------------------------------------------------------------
  test("does not respond to thumbs up press when isSubmitting", () => {
    renderButton();

    // Expand first
    act(() => {
      pressCollapsedButton();
    });

    // Re-render with isSubmitting=true
    act(() => {
      root.render(
        <FeedbackButton
          onSubmit={onSubmit}
          onDismiss={onDismiss}
          isSubmitting={true}
        />,
      );
    });

    // The thumbs up button should be disabled
    const thumbsUp = queryByTestId(container, "feedback-thumbs-up");
    expect(thumbsUp).not.toBeNull();
    const props = getReactProps(thumbsUp!);
    expect(props.disabled).toBe(true);
  });
});
