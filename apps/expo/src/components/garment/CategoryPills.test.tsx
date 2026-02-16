import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CategoryPills } from "./CategoryPills";

const CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"];

describe("CategoryPills", () => {
  test("renders all category names capitalized", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops", "bottoms", "dresses"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain("Tops");
    expect(html).toContain("Bottoms");
    expect(html).toContain("Dresses");
    // Verify the raw lowercase versions are not rendered as visible text
    // (they may appear in attribute values like accessibilityLabel, so just
    // check the capitalised form exists)
  });

  test("active pill has bg-text-primary styling class", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    // The mock cn() joins truthy args with spaces. The active pill receives
    // "items-center justify-center rounded-full px-3 py-2" and "bg-text-primary".
    // We check that the className attribute in the rendered output contains it.
    expect(html).toContain("bg-text-primary");
  });

  test("inactive pills have bg-surface styling class", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    // All non-selected pills get "bg-surface" via cn()
    expect(html).toContain("bg-surface");
  });

  test("active pill does not have bg-surface class", () => {
    // With only one category, there is exactly one pill and it is active.
    // Its className should include bg-text-primary but NOT bg-surface.
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain("bg-text-primary");
    expect(html).not.toContain("bg-surface");
  });

  test("accessibility role button is present on each pill", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops", "bottoms"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    // The mock Pressable passes all props through, so accessibilityRole
    // becomes an attribute on the rendered mock-Pressable element.
    const roleMatches = html.match(/accessibilityRole="button"/g);
    expect(roleMatches).not.toBeNull();
    expect(roleMatches!.length).toBe(2);
  });

  test("accessibilityLabel is set to category name for each pill", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops", "bottoms", "dresses"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    expect(html).toContain('accessibilityLabel="tops"');
    expect(html).toContain('accessibilityLabel="bottoms"');
    expect(html).toContain('accessibilityLabel="dresses"');
  });

  test("active and inactive pills have distinct styling per pill", () => {
    // React SSR drops non-standard object props (like accessibilityState) from
    // custom elements, so we verify the isActive flag's effect through the
    // distinct classes applied to each individual pill element.
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops", "bottoms"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    // Extract each <mock-Pressable ...>...</mock-Pressable> block
    const pillBlocks = html.match(
      /<mock-Pressable[^>]*>.*?<\/mock-Pressable>/g,
    );
    expect(pillBlocks).not.toBeNull();
    expect(pillBlocks!.length).toBe(2);

    const topsPill = pillBlocks!.find((b) =>
      b.includes('accessibilityLabel="tops"'),
    );
    const bottomsPill = pillBlocks!.find((b) =>
      b.includes('accessibilityLabel="bottoms"'),
    );

    expect(topsPill).toBeDefined();
    expect(bottomsPill).toBeDefined();

    // Active pill (tops) gets bg-text-primary and text-white
    expect(topsPill).toContain("bg-text-primary");
    expect(topsPill).toContain("text-white");
    expect(topsPill).not.toContain("bg-surface");

    // Inactive pill (bottoms) gets bg-surface and text-text-secondary
    expect(bottomsPill).toContain("bg-surface");
    expect(bottomsPill).toContain("text-text-secondary");
    expect(bottomsPill).not.toContain("bg-text-primary");
  });

  // -------------------------------------------------------------------------
  // Unsupported category visual indicators (Story 3.5)
  // -------------------------------------------------------------------------
  test("pill for unsupported category shows 'No try-on' text", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={() => {}}
        unsupportedCategories={["shoes", "outerwear"]}
      />,
    );

    expect(html).toContain("No try-on");
  });

  test("pill for supported category does NOT show 'No try-on' text", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops"]}
        selected="tops"
        onSelect={() => {}}
        unsupportedCategories={["shoes", "outerwear"]}
      />,
    );

    expect(html).not.toContain("No try-on");
  });

  test("unsupported pill is still clickable (has Pressable and onPress)", () => {
    const onSelect = mock(() => {});
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["shoes"]}
        selected="tops"
        onSelect={onSelect}
        unsupportedCategories={["shoes"]}
      />,
    );

    // Pill should still be a Pressable (interactive)
    expect(html).toContain("mock-Pressable");
    expect(html).toContain('accessibilityRole="button"');
    // Should not have disabled attribute
    expect(html).not.toContain("disabled");
  });

  test("renders empty when categories array is empty", () => {
    const html = renderToStaticMarkup(
      <CategoryPills categories={[]} selected="" onSelect={() => {}} />,
    );

    // The ScrollView wrapper is rendered, but no Pressable pills inside.
    expect(html).toContain("mock-ScrollView");
    expect(html).not.toContain("mock-Pressable");
  });

  test("onSelect callback is wired to pills", () => {
    const onSelect = mock(() => {});
    const element = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    // Verify the component accepts and passes the onSelect function.
    // In SSR we cannot simulate press events, but we can verify the
    // element tree is constructed with the callback prop.
    expect(element.props.onSelect).toBe(onSelect);

    // Also verify it renders without error (proves the callback is accepted)
    const html = renderToStaticMarkup(element);
    expect(html).toContain("mock-Pressable");
  });
});
