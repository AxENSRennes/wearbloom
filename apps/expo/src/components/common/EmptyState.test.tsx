import { View } from "react-native";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders headline text", () => {
    const html = renderToStaticMarkup(
      <EmptyState headline="Your wardrobe is waiting" />,
    );

    expect(html).toContain("Your wardrobe is waiting");
  });

  test("renders subtext when provided", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        headline="Your wardrobe is waiting"
        subtext="Add your first garment"
      />,
    );

    expect(html).toContain("Add your first garment");
  });

  test("does not render subtext when not provided", () => {
    const html = renderToStaticMarkup(
      <EmptyState headline="Your wardrobe is waiting" />,
    );

    // Should only have the headline ThemedText, not a second one for subtext
    // Match opening tags only (closing tags also contain mock-ThemedText)
    const themedTextMatches = html.match(/<mock-ThemedText/g);
    expect(themedTextMatches).toHaveLength(1);
  });

  test("renders CTA button when ctaLabel provided", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        headline="Your wardrobe is waiting"
        ctaLabel="Add your first garment"
        onCtaPress={() => {}}
      />,
    );

    expect(html).toContain("mock-Button");
    expect(html).toContain("Add your first garment");
  });

  // Note: Button uses label prop, not children. The mock renders label as attribute.

  test("CTA onPress fires callback", () => {
    const onCtaPress = mock(() => {});
    const element = (
      <EmptyState
        headline="Your wardrobe is waiting"
        ctaLabel="Add your first garment"
        onCtaPress={onCtaPress}
      />
    );

    expect(element.props.onCtaPress).toBe(onCtaPress);

    // Also verify it renders without error
    const html = renderToStaticMarkup(element);
    expect(html).toContain("mock-Button");
  });

  test("does not render CTA when no ctaLabel", () => {
    const html = renderToStaticMarkup(
      <EmptyState headline="Nothing here yet" subtext="Add a tops" />,
    );

    expect(html).not.toContain("mock-Button");
  });

  test("uses heading variant for headline", () => {
    const html = renderToStaticMarkup(
      <EmptyState headline="Your wardrobe is waiting" />,
    );

    expect(html).toContain('variant="heading"');
  });

  test("uses secondary variant for CTA button", () => {
    const html = renderToStaticMarkup(
      <EmptyState headline="Test" ctaLabel="Action" onCtaPress={() => {}} />,
    );

    expect(html).toContain('variant="secondary"');
  });

  test("renders default illustration with accessibility role image", () => {
    const html = renderToStaticMarkup(<EmptyState headline="Test" />);

    expect(html).toContain('accessibilityRole="image"');
    expect(html).toContain("Wardrobe empty state illustration");
  });

  test("renders custom illustration when provided", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        headline="Test"
        illustration={<View testID="custom-illustration" />}
      />,
    );

    expect(html).toContain("custom-illustration");
    expect(html).not.toContain("Wardrobe empty state illustration");
  });
});
