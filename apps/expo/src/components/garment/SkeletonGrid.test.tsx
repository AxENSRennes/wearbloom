import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SkeletonGrid } from "./SkeletonGrid";

describe("SkeletonGrid", () => {
  test("renders 6 skeleton items", () => {
    const html = renderToStaticMarkup(<SkeletonGrid columnWidth={194} />);

    // Each skeleton item is a View, count the skeleton item markers
    const skeletonItems = html.match(/data-testid="skeleton-item"/g);
    expect(skeletonItems).toHaveLength(6);
  });

  test("skeleton items have correct width and height attributes", () => {
    const columnWidth = 194;
    const expectedHeight = Math.round(columnWidth * 1.2);
    const html = renderToStaticMarkup(<SkeletonGrid columnWidth={columnWidth} />);

    // The ReanimatedView mock flattens style arrays, so dimensions appear in SSR output
    expect(html).toContain(`width:${columnWidth}px`);
    expect(html).toContain(`height:${expectedHeight}px`);
  });

  test("renders in a 2-column layout with gap", () => {
    const html = renderToStaticMarkup(<SkeletonGrid columnWidth={194} />);

    // Should have 3 rows (6 items / 2 columns)
    const rows = html.match(/data-testid="skeleton-row"/g);
    expect(rows).toHaveLength(3);
  });
});
