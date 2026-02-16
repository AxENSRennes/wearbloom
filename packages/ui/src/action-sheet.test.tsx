import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";

import { ActionSheet } from "./action-sheet";

describe("ActionSheet", () => {
  test("renders items when open", () => {
    const items = [
      { label: "Take Photo", onPress: mock(() => {}) },
      { label: "Import from Gallery", onPress: mock(() => {}) },
    ];

    const html = renderToString(
      <ActionSheet isOpen={true} onClose={mock(() => {})} items={items} />,
    );

    expect(html).toContain("Take Photo");
    expect(html).toContain("Import from Gallery");
  });

  test("renders cancel button", () => {
    const html = renderToString(
      <ActionSheet
        isOpen={true}
        onClose={mock(() => {})}
        items={[{ label: "Option", onPress: mock(() => {}) }]}
      />,
    );

    expect(html).toContain("Cancel");
  });

  test("renders with accessibility labels", () => {
    const items = [{ label: "Take Photo", onPress: mock(() => {}) }];

    const html = renderToString(
      <ActionSheet isOpen={true} onClose={mock(() => {})} items={items} />,
    );

    expect(html).toContain("Take Photo");
    expect(html).toContain("Close");
  });
});
