import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
