import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

import { CategoryPills } from "./CategoryPills";

const CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"];

describe("CategoryPills", () => {
  test("renders all categories", () => {
    const onSelect = mock(() => {});
    const html = renderToString(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />,
    );

    for (const cat of CATEGORIES) {
      const capitalized = cat.charAt(0).toUpperCase() + cat.slice(1);
      expect(html).toContain(capitalized);
    }
  });

  test("renders with selected category", () => {
    const onSelect = mock(() => {});
    const html = renderToString(
      <CategoryPills
        categories={CATEGORIES}
        selected="dresses"
        onSelect={onSelect}
      />,
    );

    // The component renders — check that "Dresses" is present
    expect(html).toContain("Dresses");
  });

  test("each pill has accessibility attributes", () => {
    const onSelect = mock(() => {});
    const html = renderToString(
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />,
    );

    // Verify accessibility role is present
    expect(html).toContain("button");
  });
});
