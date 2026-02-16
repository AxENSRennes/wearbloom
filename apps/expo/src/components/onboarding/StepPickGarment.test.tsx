import { createElement } from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { StepPickGarment } from "./StepPickGarment";

describe("StepPickGarment", () => {
  test("renders headline text", () => {
    const html = renderToString(
      createElement(StepPickGarment, {
        onGarmentSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("Now, choose something to try");
  });

  test("renders garment grid with stock garments", () => {
    const html = renderToString(
      createElement(StepPickGarment, {
        onGarmentSelected: mock(() => {}),
      }),
    );
    // Should render multiple ExpoImage components for garment cards
    const imageCount = (html.match(/<mock-ExpoImage/g) ?? []).length;
    expect(imageCount).toBeGreaterThanOrEqual(6);
  });

  test("renders 'Or photograph your own' ghost link", () => {
    const html = renderToString(
      createElement(StepPickGarment, {
        onGarmentSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("Or photograph your own");
  });

  test("garment cards have accessibility labels", () => {
    const html = renderToString(
      createElement(StepPickGarment, {
        onGarmentSelected: mock(() => {}),
      }),
    );
    // Each garment should have its label as accessibility text
    expect(html).toContain("White T-Shirt");
    expect(html).toContain("Blue Blouse");
  });

  test("garment cards have button accessibility role", () => {
    const html = renderToString(
      createElement(StepPickGarment, {
        onGarmentSelected: mock(() => {}),
      }),
    );
    expect(html).toContain('accessibilityRole="button"');
  });
});
