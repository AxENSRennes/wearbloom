import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WardrobeScreen from "./index";

describe("WardrobeScreen", () => {
  test("renders SafeAreaView as root container", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("mock-SafeAreaView");
  });

  test("renders CategoryPills with All as first option", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // CategoryPills should render "All" pill (capitalized from "all")
    expect(html).toContain("All");
  });

  test("renders LegendList grid component", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // LegendList mock renders as mock-LegendList
    expect(html).toContain("mock-LegendList");
  });

  test("passes numColumns=2 to LegendList for grid layout", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain('numColumns="2"');
  });

  test("passes recycleItems prop to LegendList for performance", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    // Boolean prop rendered as empty attribute in SSR
    expect(html).toContain("recycleItems");
  });

  test("shows empty state when no garments returned", () => {
    // Default mock useQuery returns data: null (initialData),
    // which the component should treat as empty
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("Your wardrobe is waiting");
  });

  test("renders CategoryPills with all garment categories", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // Should contain all categories (capitalized)
    expect(html).toContain("Tops");
    expect(html).toContain("Bottoms");
    expect(html).toContain("Dresses");
    expect(html).toContain("Shoes");
    expect(html).toContain("Outerwear");
  });

  test("CategoryPills sticky header has semi-transparent background", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // The sticky header container should have bg-white/90
    expect(html).toContain("bg-white/90");
  });
});
