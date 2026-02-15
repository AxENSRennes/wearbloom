import { mock } from "bun:test";

const React = await import("react");

// ---------------------------------------------------------------------------
// expo-secure-store — in-memory mock for consent/session storage
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

mock.module("expo-secure-store", () => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    store.delete(key);
  },
  __store: store,
}));

// ---------------------------------------------------------------------------
// React Native — minimal component mocks
// ---------------------------------------------------------------------------
function mockComponent(name: string) {
  const comp = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const { children, ...rest } = props;
      return React.createElement(
        `mock-${name}`,
        { ...rest, ref },
        children as React.ReactNode,
      );
    },
  );
  comp.displayName = name;
  return comp;
}

mock.module("react-native", () => ({
  View: mockComponent("View"),
  Text: mockComponent("Text"),
  ScrollView: mockComponent("ScrollView"),
  Pressable: mockComponent("Pressable"),
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
  Platform: {
    OS: "ios",
    select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
  },
}));

mock.module("react-native-safe-area-context", () => ({
  SafeAreaView: mockComponent("SafeAreaView"),
  SafeAreaProvider: mockComponent("SafeAreaProvider"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------
// Gluestack UI — mock core and utils (required by @acme/ui)
// ---------------------------------------------------------------------------
mock.module("@gluestack-ui/core", () => ({
  createButton: () => {
    const Comp = React.forwardRef(
      (props: Record<string, unknown>, ref: unknown) => {
        const { children, ...rest } = props;
        return React.createElement(
          "mock-GluestackButton",
          { ...rest, ref },
          children as React.ReactNode,
        );
      },
    );
    const Text = mockComponent("ButtonText");
    return Object.assign(Comp, {
      Text,
      Group: mockComponent("ButtonGroup"),
      Spinner: mockComponent("ButtonSpinner"),
      Icon: mockComponent("ButtonIcon"),
    });
  },
}));

mock.module("@gluestack-ui/utils/nativewind-utils", () => ({
  tva: (config: Record<string, unknown>) => (props: Record<string, unknown>) => {
    const base = (config.base as string) ?? "";
    const variants = config.variants as Record<string, Record<string, string>> | undefined;
    const defaultVariants = config.defaultVariants as Record<string, string> | undefined;
    let cls = base;
    if (variants) {
      for (const [key, map] of Object.entries(variants)) {
        const val = (props[key] as string) ?? (defaultVariants?.[key] as string | undefined);
        if (val && map[val]) cls += " " + map[val];
      }
    }
    return cls;
  },
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  withStyleContext: () => (comp: unknown) => comp,
  useStyleContext: () => ({}),
}));

// ---------------------------------------------------------------------------
// Expo Router — mock navigation primitives
// ---------------------------------------------------------------------------
const routerMock = {
  push: mock(() => {}),
  replace: mock(() => {}),
  back: mock(() => {}),
  canGoBack: () => true,
};

mock.module("expo-router", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  Redirect: mockComponent("Redirect"),
  Slot: mockComponent("Slot"),
  Stack: Object.assign(mockComponent("Stack"), {
    Screen: mockComponent("StackScreen"),
  }),
  Link: mockComponent("Link"),
  __router: routerMock,
}));

// ---------------------------------------------------------------------------
// lucide-react-native — mock icons as simple components
// ---------------------------------------------------------------------------
mock.module("lucide-react-native", () => ({
  Home: mockComponent("Icon-Home"),
  Plus: mockComponent("Icon-Plus"),
  User: mockComponent("Icon-User"),
  ChevronRight: mockComponent("Icon-ChevronRight"),
}));
