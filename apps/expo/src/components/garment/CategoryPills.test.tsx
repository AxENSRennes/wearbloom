import { afterEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CategoryPills } from "./CategoryPills";

const CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"];

describe("CategoryPills", () => {
  afterEach(() => {
    mock.restore();
  });

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
  });

  test("active pill has bg-text-primary styling class", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={() => {}}
      />,
    );

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

    expect(html).toContain("bg-surface");
  });

  test("accessibility role button is present on each pill", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["tops", "bottoms"]}
        selected="tops"
        onSelect={() => {}}
      />,
    );

    const roleMatches = html.match(/accessibilityRole="button"/g);
    expect(roleMatches).not.toBeNull();
    expect(roleMatches?.length).toBe(2);
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

  test("unsupported category shows No try-on helper text", () => {
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

  test("unsupported category has accessibility hint in label", () => {
    const html = renderToStaticMarkup(
      <CategoryPills
        categories={["shoes"]}
        selected="tops"
        onSelect={() => {}}
        unsupportedCategories={["shoes"]}
      />,
    );

    expect(html).toContain('accessibilityLabel="shoes, try-on not available"');
  });

  test("renders no pills when categories is empty", () => {
    const html = renderToStaticMarkup(
      <CategoryPills categories={[]} selected="" onSelect={() => {}} />,
    );

    expect(html).toContain("mock-ScrollView");
    expect(html).not.toContain("mock-Pressable");
  });
});
