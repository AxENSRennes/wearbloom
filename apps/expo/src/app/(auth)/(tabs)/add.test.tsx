import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

import AddGarmentScreen from "./add";

describe("AddGarmentScreen", () => {
  test("renders initial idle state with source selection prompt", () => {
    const html = renderToString(<AddGarmentScreen />);

    expect(html).toContain("Add a Garment");
    expect(html).toContain("Take Photo");
  });

  test("renders garment description text", () => {
    const html = renderToString(<AddGarmentScreen />);

    expect(html).toContain(
      "Take a photo of your garment or import one from your gallery",
    );
  });

  test("renders ActionSheet component for source selection", () => {
    const html = renderToString(<AddGarmentScreen />);

    // ActionSheet component is rendered (mocked)
    expect(html).toContain("ActionSheet");
  });
});
