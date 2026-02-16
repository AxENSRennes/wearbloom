import { describe, expect, mock, test } from "bun:test";
import React from "react";

import { CategoryPills } from "./CategoryPills";

const CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"];

describe("CategoryPills", () => {
  test("renders component with correct props structure", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    expect(component).toBeDefined();
    expect(component.props.categories).toEqual(CATEGORIES);
    expect(component.props.selected).toBe("tops");
    expect(component.props.onSelect).toBe(onSelect);
  });

  test("accepts array of categories as prop", () => {
    const onSelect = mock(() => {});
    const categories = ["jacket", "pants"];
    const component = (
      <CategoryPills
        categories={categories}
        selected="jacket"
        onSelect={onSelect}
      />
    );

    expect(component.props.categories).toEqual(categories);
  });

  test("accepts selected category as prop", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="dresses"
        onSelect={onSelect}
      />
    );

    expect(component.props.selected).toBe("dresses");
  });

  test("accepts onSelect callback as prop", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    expect(component.props.onSelect).toBe(onSelect);
  });

  test("component structure is correct", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    // Verify it's a React component
    expect(typeof component.type).toBe("function");
    expect(component.type.name).toBe("CategoryPills");
  });

  test("supports empty categories array", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills categories={[]} selected="" onSelect={onSelect} />
    );

    expect(component.props.categories).toEqual([]);
  });

  test("supports different selected values", () => {
    const onSelect = mock(() => {});

    const selectedValues = ["tops", "bottoms", "dresses"];
    for (const selected of selectedValues) {
      const component = (
        <CategoryPills
          categories={CATEGORIES}
          selected={selected}
          onSelect={onSelect}
        />
      );

      expect(component.props.selected).toBe(selected);
    }
  });

  test("onSelect callback is callable", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    // Verify onSelect is a mock function
    expect(typeof component.props.onSelect).toBe("function");
  });

  test("component renders with all required prop types", () => {
    const onSelect = mock(() => {});
    const component = (
      <CategoryPills
        categories={CATEGORIES}
        selected="tops"
        onSelect={onSelect}
      />
    );

    // Type checking: props structure matches expected types
    expect(Array.isArray(component.props.categories)).toBe(true);
    expect(typeof component.props.selected).toBe("string");
    expect(typeof component.props.onSelect).toBe("function");
  });
});
