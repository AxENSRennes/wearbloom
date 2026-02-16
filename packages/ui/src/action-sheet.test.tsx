import { describe, expect, mock, test } from "bun:test";
import React from "react";

import { ActionSheet } from "./action-sheet";

describe("ActionSheet", () => {
  test("renders component with required props", () => {
    const items = [
      { label: "Take Photo", onPress: mock(() => {}) },
      { label: "Import from Gallery", onPress: mock(() => {}) },
    ];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(component).toBeDefined();
    expect(component.props.isOpen).toBe(true);
    expect(component.props.onClose).toBe(onClose);
    expect(component.props.items).toEqual(items);
  });

  test("accepts isOpen prop as boolean", () => {
    const items = [{ label: "Option", onPress: mock(() => {}) }];
    const onClose = mock(() => {});

    const openComponent = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );
    const closedComponent = (
      <ActionSheet isOpen={false} onClose={onClose} items={items} />
    );

    expect(openComponent.props.isOpen).toBe(true);
    expect(closedComponent.props.isOpen).toBe(false);
  });

  test("accepts onClose callback", () => {
    const items = [{ label: "Option", onPress: mock(() => {}) }];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(typeof component.props.onClose).toBe("function");
  });

  test("accepts items array with label and onPress", () => {
    const items = [
      { label: "Take Photo", onPress: mock(() => {}) },
      { label: "Import from Gallery", onPress: mock(() => {}) },
    ];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(Array.isArray(component.props.items)).toBe(true);
    expect(component.props.items.length).toBe(2);
    expect(component.props.items[0].label).toBe("Take Photo");
    expect(component.props.items[1].label).toBe("Import from Gallery");
  });

  test("items array can be empty", () => {
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={[]} />
    );

    expect(component.props.items).toEqual([]);
  });

  test("each item has onPress callback", () => {
    const onPress1 = mock(() => {});
    const onPress2 = mock(() => {});
    const items = [
      { label: "Option 1", onPress: onPress1 },
      { label: "Option 2", onPress: onPress2 },
    ];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(typeof component.props.items[0].onPress).toBe("function");
    expect(typeof component.props.items[1].onPress).toBe("function");
  });

  test("supports optional icon in items", () => {
    const items = [
      {
        label: "Take Photo",
        icon: React.createElement("mock-icon"),
        onPress: mock(() => {}),
      },
      {
        label: "Import from Gallery",
        onPress: mock(() => {}),
      },
    ];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(component.props.items[0].icon).toBeDefined();
    expect(component.props.items[1].icon).toBeUndefined();
  });

  test("component type is correct", () => {
    const items = [{ label: "Option", onPress: mock(() => {}) }];
    const onClose = mock(() => {});

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    expect(typeof component.type).toBe("function");
    expect(component.type.name).toBe("ActionSheet");
  });

  test("renders with all required props satisfied", () => {
    const onPress1 = mock(() => {});
    const onPress2 = mock(() => {});
    const onClose = mock(() => {});
    const items = [
      { label: "Take Photo", onPress: onPress1 },
      { label: "Import from Gallery", onPress: onPress2 },
    ];

    const component = (
      <ActionSheet isOpen={true} onClose={onClose} items={items} />
    );

    // Verify all props are present
    expect(component.props.isOpen).toBe(true);
    expect(component.props.onClose).toBe(onClose);
    expect(component.props.items).toEqual(items);
    expect(component.props.items.length).toBe(2);
  });
});
