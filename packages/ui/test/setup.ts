import { mock } from "bun:test";

// React Native must be mocked before any UI component imports.
// mock.module() is irreversible in bun — this preload ensures all
// test files in packages/ui get consistent RN mocks.

const React = await import("react");

function mockComponent(name: string) {
  const comp = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { children, ...rest } = props;
    // Support render-prop children (e.g. Pressable's ({ pressed }) => ...)
    const resolved =
      typeof children === "function"
        ? (children as (state: { pressed: boolean }) => React.ReactNode)({ pressed: false })
        : children;
    return React.createElement(`mock-${name}`, { ...rest, ref }, resolved as React.ReactNode);
  });
  comp.displayName = name;
  return comp;
}

// @gluestack-ui/core has a package.json main pointing to .js but actual
// files are .jsx — Bun cannot resolve it. Mock createButton to return a
// minimal compound component for unit-testing purposes.
mock.module("@gluestack-ui/core", () => {
  return {
    createButton: (_styledComponents: Record<string, unknown>) => {
      const Comp = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
        const { children, ...rest } = props;
        return React.createElement("mock-GluestackButton", { ...rest, ref }, children as React.ReactNode);
      });
      // Attach compound sub-components
      const Text = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
        const { children, ...rest } = props;
        return React.createElement("mock-ButtonText", { ...rest, ref }, children as React.ReactNode);
      });
      return Object.assign(Comp, {
        Text,
        Group: mockComponent("ButtonGroup"),
        Spinner: mockComponent("ButtonSpinner"),
        Icon: mockComponent("ButtonIcon"),
      });
    },
  };
});

mock.module("react-native", () => ({
  View: mockComponent("View"),
  Text: mockComponent("Text"),
  Pressable: mockComponent("Pressable"),
  Modal: mockComponent("Modal"),
  ActivityIndicator: mockComponent("ActivityIndicator"),
  Animated: {
    Value: class AnimatedValue {
      _value: number;
      constructor(value: number) {
        this._value = value;
      }
      setValue(value: number) {
        this._value = value;
      }
    },
    View: mockComponent("AnimatedView"),
    timing: (_value: unknown, _config: unknown) => ({
      start: (cb?: (result: { finished: boolean }) => void) =>
        cb?.({ finished: true }),
    }),
    spring: (_value: unknown, _config: unknown) => ({
      start: (cb?: (result: { finished: boolean }) => void) =>
        cb?.({ finished: true }),
    }),
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
  },
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
}));
