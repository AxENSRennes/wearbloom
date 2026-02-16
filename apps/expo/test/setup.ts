import { mock } from "bun:test";

// Define globals normally provided by Metro/React Native bundler
// @ts-expect-error -- __DEV__ is a global set by Metro bundler
globalThis.__DEV__ = true;
// @ts-expect-error -- EXPO_OS is inlined by babel-preset-expo
globalThis.process.env.EXPO_OS = "ios";
// @ts-expect-error -- expo global is set by expo-modules-core native runtime
globalThis.expo = {
  EventEmitter: class MockEventEmitter {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    emit() {}
    listenerCount() { return 0; }
  },
  modules: {},
  uuidv4: () => "mock-uuid",
  uuidv5: () => "mock-uuid",
  getViewConfig: () => ({}),
};

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
  TextInput: mockComponent("TextInput"),
  ScrollView: mockComponent("ScrollView"),
  Pressable: mockComponent("Pressable"),
  TouchableOpacity: mockComponent("TouchableOpacity"),
  ActivityIndicator: mockComponent("ActivityIndicator"),
  Image: mockComponent("Image"),
  Modal: mockComponent("Modal"),
  FlatList: mockComponent("FlatList"),
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
  LayoutAnimation: {
    configureNext: mock(() => {}),
    create: (_duration: number, _type: unknown, _prop: unknown) => ({}),
    Types: { easeInEaseOut: "easeInEaseOut", linear: "linear", spring: "spring" },
    Properties: { opacity: "opacity", scaleX: "scaleX", scaleY: "scaleY", scaleXY: "scaleXY" },
  },
  StyleSheet: {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    flatten: (s: unknown) => s,
  },
  Platform: {
    OS: "ios",
    select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
    Version: 17,
  },
  TurboModuleRegistry: { get: () => null, getEnforcing: () => ({}) },
  NativeModules: {},
  NativeEventEmitter: class NativeEventEmitter {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    listenerCount() { return 0; }
  },
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => {} }) },
  Dimensions: { get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }) },
  PixelRatio: { get: () => 2, getPixelSizeForLayoutSize: (s: number) => s * 2 },
  Appearance: { getColorScheme: () => "light", addChangeListener: () => ({ remove: () => {} }) },
  Linking: { openURL: mock(() => Promise.resolve()), canOpenURL: mock(() => Promise.resolve(true)) },
  Alert: { alert: mock(() => {}) },
  I18nManager: { isRTL: false },
  StatusBar: mockComponent("RNStatusBar"),
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  useColorScheme: () => "light",
  processColor: (color: unknown) => color,
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
// expo-constants — mock Constants for base URL resolution
// ---------------------------------------------------------------------------
mock.module("expo-constants", () => ({
  default: {
    expoConfig: {
      hostUri: "localhost:3000",
    },
  },
}));

// ---------------------------------------------------------------------------
// expo-image-picker — mock camera and gallery pickers
// ---------------------------------------------------------------------------
mock.module("expo-image-picker", () => ({
  launchCameraAsync: mock(() =>
    Promise.resolve({
      canceled: false,
      assets: [
        {
          uri: "file:///mock/photo.jpg",
          width: 3000,
          height: 4000,
          type: "image",
        },
      ],
    }),
  ),
  launchImageLibraryAsync: mock(() =>
    Promise.resolve({
      canceled: false,
      assets: [
        {
          uri: "file:///mock/gallery.jpg",
          width: 2000,
          height: 3000,
          type: "image",
        },
      ],
    }),
  ),
  requestCameraPermissionsAsync: mock(() =>
    Promise.resolve({ status: "granted" }),
  ),
  requestMediaLibraryPermissionsAsync: mock(() =>
    Promise.resolve({ status: "granted" }),
  ),
}));

// ---------------------------------------------------------------------------
// expo-image-manipulator — mock image manipulation
// ---------------------------------------------------------------------------
mock.module("expo-image-manipulator", () => ({
  manipulateAsync: mock(() =>
    Promise.resolve({
      uri: "file:///mock/compressed.jpg",
      width: 1200,
      height: 1600,
    }),
  ),
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
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
  router: routerMock,
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
// expo-image — mock Image component for auth-gated image loading
// ---------------------------------------------------------------------------
mock.module("expo-image", () => ({
  Image: mockComponent("ExpoImage"),
}));

// ---------------------------------------------------------------------------
// lucide-react-native — mock icons as simple components
// ---------------------------------------------------------------------------
mock.module("lucide-react-native", () => ({
  Camera: mockComponent("Icon-Camera"),
  Home: mockComponent("Icon-Home"),
  ImageIcon: mockComponent("Icon-ImageIcon"),
  Plus: mockComponent("Icon-Plus"),
  User: mockComponent("Icon-User"),
  ChevronRight: mockComponent("Icon-ChevronRight"),
}));

// ---------------------------------------------------------------------------
// better-auth — mock auth client and server (third-party with side effects)
// ---------------------------------------------------------------------------
const mockAuthClient = {
  useSession: () => ({ data: null, isPending: false, error: null }),
  signIn: {
    email: mock(() => Promise.resolve({ data: null, error: null })),
    social: mock(() => Promise.resolve({ data: null, error: null })),
  },
  signUp: {
    email: mock(() => Promise.resolve({ data: null, error: null })),
  },
  signOut: mock(() => Promise.resolve()),
  updateUser: mock(() => Promise.resolve({ data: null, error: null })),
  getCookie: () => null,
};

mock.module("better-auth/react", () => ({
  createAuthClient: () => mockAuthClient,
}));

mock.module("@better-auth/expo/client", () => ({
  expoClient: () => ({ id: "expoClient" }),
}));

// ---------------------------------------------------------------------------
// expo-apple-authentication — mock Apple Sign-In SDK
// ---------------------------------------------------------------------------
mock.module("expo-apple-authentication", () => ({
  signInAsync: mock(() =>
    Promise.resolve({
      identityToken: "mock-apple-id-token",
      fullName: { givenName: "Test", familyName: "User" },
      email: "test@privaterelay.appleid.com",
    }),
  ),
  AppleAuthenticationButton: mockComponent("AppleAuthenticationButton"),
  AppleAuthenticationButtonType: { SIGN_IN: 0, SIGN_UP: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// ---------------------------------------------------------------------------
// @tanstack/react-query — mock useMutation for auth screens
// ---------------------------------------------------------------------------
mock.module("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    defaultOptions = {};
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useQuery: (opts: Record<string, unknown>) => ({
    data: (opts as { initialData?: unknown }).initialData ?? null,
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    refetch: mock(() => Promise.resolve()),
  }),
  useMutation: () => ({
    mutate: mock(() => {}),
    mutateAsync: mock(() => Promise.resolve()),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  }),
  useQueryClient: () => ({
    invalidateQueries: mock(() => Promise.resolve()),
  }),
}));

// ---------------------------------------------------------------------------
// Expo SDK modules — fonts, splash screen, status bar
// ---------------------------------------------------------------------------
mock.module("@expo-google-fonts/dm-serif-display", () => ({
  useFonts: () => [true, null],
  DMSerifDisplay_400Regular: "DMSerifDisplay_400Regular",
}));

mock.module("expo-splash-screen", () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
}));

mock.module("expo-status-bar", () => ({
  StatusBar: ({ style: _style, ...rest }: Record<string, unknown>) =>
    React.createElement("mock-StatusBar", rest),
}));

// ---------------------------------------------------------------------------
// @acme/ui — mock all exported components and utilities
// ---------------------------------------------------------------------------
const MockButton = Object.assign(mockComponent("Button"), {
  Text: mockComponent("ButtonText"),
});
mock.module("@acme/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  tva: (config: Record<string, unknown>) => () => (config.base as string) ?? "",
  withStyleContext: () => (comp: unknown) => comp,
  useStyleContext: () => ({}),
  Button: MockButton,
  GluestackButton: MockButton,
  buttonStyle: () => "",
  buttonTextStyle: () => "",
  ThemedText: mockComponent("ThemedText"),
  themedTextStyle: () => "",
  Spinner: mockComponent("Spinner"),
  ThemedPressable: mockComponent("ThemedPressable"),
  AlertDialog: mockComponent("AlertDialog"),
  alertDialogButtonStyle: () => "",
  alertDialogButtonTextStyle: () => "",
  ActionSheet: mockComponent("ActionSheet"),
  ToastProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  showToast: mock(() => {}),
  wearbloomTheme: {
    colors: {
      primary: "#4c6ef5",
      neutral: "#868e96",
      "text-tertiary": "#A3A3A3",
    },
  },
}));

// ---------------------------------------------------------------------------
// tRPC and superjson — imported transitively via ~/utils/api
// ---------------------------------------------------------------------------
mock.module("@trpc/client", () => ({
  createTRPCClient: () => ({}),
  httpBatchLink: () => ({}),
  loggerLink: () => ({}),
}));

// Create a deep proxy that returns mock query/mutation options for any path
function createMockTRPCProxy(): unknown {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "queryOptions") return () => ({ queryKey: ["mock"] });
      if (prop === "mutationOptions") return (opts?: Record<string, unknown>) => ({ ...opts });
      if (prop === "queryKey") return () => ["mock"];
      if (typeof prop === "string") return new Proxy({}, handler);
      return undefined;
    },
  };
  return new Proxy({}, handler);
}

mock.module("@trpc/tanstack-react-query", () => ({
  createTRPCOptionsProxy: () => createMockTRPCProxy(),
}));

mock.module("superjson", () => ({
  default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v },
}));

// ---------------------------------------------------------------------------
// react-native-reanimated — mock animation hooks for press/skeleton animations
// ---------------------------------------------------------------------------
mock.module("react-native-reanimated", () => {
  // Animated.View flattens style arrays so SSR tests can inspect style values
  const AnimatedView = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const { children, style, ...rest } = props;
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...(style as Record<string, unknown>[]))
        : style;
      return React.createElement(
        "mock-ReanimatedView",
        { ...rest, style: flatStyle, ref },
        children as React.ReactNode,
      );
    },
  );
  AnimatedView.displayName = "ReanimatedView";
  return {
    default: {
      View: AnimatedView,
      createAnimatedComponent: (comp: unknown) => comp,
    },
    View: AnimatedView,
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    withSpring: (toValue: number) => toValue,
    withTiming: (toValue: number) => toValue,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[0],
    useReducedMotion: () => false,
    Easing: {
      linear: 0,
      ease: 1,
      inOut: () => 0,
    },
    createAnimatedComponent: (comp: unknown) => comp,
  };
});

// ---------------------------------------------------------------------------
// @legendapp/list — mock LegendList as a basic list renderer
// ---------------------------------------------------------------------------
mock.module("@legendapp/list", () => ({
  LegendList: React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const {
        data,
        renderItem,
        ListEmptyComponent,
        ListHeaderComponent,
        refreshing: _refreshing,
        onRefresh: _onRefresh,
        ...rest
      } = props as {
        data?: unknown[];
        renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
        ListEmptyComponent?: React.ComponentType | React.ReactElement;
        ListHeaderComponent?: React.ComponentType | React.ReactElement;
        refreshing?: boolean;
        onRefresh?: () => void;
        [key: string]: unknown;
      };

      const hasItems = Array.isArray(data) && data.length > 0;
      const items = hasItems && renderItem
        ? data.map((item, index) => renderItem({ item, index }))
        : null;

      const empty = !hasItems && ListEmptyComponent
        ? typeof ListEmptyComponent === "function"
          ? React.createElement(ListEmptyComponent as React.ComponentType)
          : ListEmptyComponent
        : null;

      const header = ListHeaderComponent
        ? typeof ListHeaderComponent === "function"
          ? React.createElement(ListHeaderComponent as React.ComponentType)
          : ListHeaderComponent
        : null;

      return React.createElement(
        "mock-LegendList",
        { ...rest, ref },
        header,
        items ?? empty,
      );
    },
  ),
}));
