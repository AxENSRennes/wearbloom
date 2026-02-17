import { createElement } from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StockPhotoReplacementBanner } from "./StockPhotoReplacementBanner";

describe("StockPhotoReplacementBanner", () => {
  test("renders headline text", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain("You&#x27;re using an example photo");
  });

  test("renders subtitle text", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain("Add your own for more realistic try-ons");
  });

  test("renders CTA button", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain("Add Your Photo");
  });

  test("renders camera icon", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain("Icon-Camera");
  });

  test("has correct accessibility label", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain(
      "You&#x27;re using an example body photo",
    );
  });

  test("has summary accessibility role", () => {
    const html = renderToStaticMarkup(
      createElement(StockPhotoReplacementBanner),
    );
    expect(html).toContain('accessibilityRole="summary"');
  });
});
