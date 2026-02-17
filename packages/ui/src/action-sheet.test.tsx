import React from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ActionSheetProps } from "./action-sheet";
import { ActionSheet } from "./action-sheet";

function render(
  props: Partial<ActionSheetProps> & { items?: ActionSheetProps["items"] },
) {
  return renderToStaticMarkup(
    React.createElement(ActionSheet, {
      isOpen: true,
      onClose: () => {},
      items: [],
      ...props,
    }),
  );
}

describe("ActionSheet", () => {
  test("renders Modal with visible=true when isOpen", () => {
    const html = render({ isOpen: true });
    expect(html).toContain("mock-Modal");
    expect(html).toContain('visible=""');
  });

  test("renders Modal without visible when not isOpen", () => {
    const htmlOpen = render({ isOpen: true });
    const htmlClosed = render({ isOpen: false });
    expect(htmlOpen).toContain('visible=""');
    expect(htmlClosed).not.toContain('visible=""');
  });

  test("renders all item labels", () => {
    const items = [
      { label: "Take Photo", onPress: mock(() => {}) },
      { label: "Import from Gallery", onPress: mock(() => {}) },
    ];
    const html = render({ items });
    expect(html).toContain("Take Photo");
    expect(html).toContain("Import from Gallery");
  });

  test("renders Cancel button", () => {
    const html = render({});
    expect(html).toContain("Cancel");
    expect(html).toContain('accessibilityLabel="Cancel"');
  });

  test("renders drag indicator", () => {
    const html = render({});
    // The drag indicator is a View with specific sizing classes inside a centering container
    expect(html).toContain("h-1 w-10 rounded-full bg-border");
  });

  test("renders close backdrop with accessibility", () => {
    const html = render({});
    expect(html).toContain('accessibilityLabel="Close"');
    expect(html).toContain('accessibilityRole="button"');
  });

  test("renders item icons when provided", () => {
    const icon = React.createElement("mock-CameraIcon", null, null);
    const items = [{ label: "Take Photo", icon, onPress: mock(() => {}) }];
    const html = render({ items });
    expect(html).toContain("mock-CameraIcon");
    // Icon wrapper View has mr-3 class
    expect(html).toContain("mr-3");
  });

  test("does not render icon wrapper when icon not provided", () => {
    const items = [{ label: "Take Photo", onPress: mock(() => {}) }];
    const html = render({ items });
    // No icon wrapper with mr-3 class should be present
    expect(html).not.toContain("mr-3");
  });

  test("items have correct accessibility attributes", () => {
    const items = [
      { label: "Take Photo", onPress: mock(() => {}) },
      { label: "Import from Gallery", onPress: mock(() => {}) },
    ];
    const html = render({ items });
    expect(html).toContain('accessibilityRole="button"');
    expect(html).toContain('accessibilityLabel="Take Photo"');
    expect(html).toContain('accessibilityLabel="Import from Gallery"');
  });
});
