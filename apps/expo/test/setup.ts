import { mock } from "bun:test";
import { plugin } from "bun";

// ---------------------------------------------------------------------------
// Image asset loader — Metro resolves require("*.png") to numeric IDs at build
// time. Bun doesn't understand binary image files, so intercept and return a
// mock numeric ID for each image.
// ---------------------------------------------------------------------------
let imageIdCounter = 1;
plugin({
  name: "image-loader",
  setup(build) {
    build.onLoad(
      { filter: /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/ },
      () => ({
        contents: `export default ${imageIdCounter++};`,
        loader: "js",
      }),
    );
  },
});

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
  FlatList: React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const { data, renderItem, keyExtractor, ...rest } = props as {
        data?: unknown[];
        renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
        keyExtractor?: (item: unknown, index: number) => string;
        [key: string]: unknown;
      };
      const items = Array.isArray(data) && renderItem
        ? data.map((item, index) =>
            React.createElement(
              "mock-FlatListItem",
              { key: keyExtractor ? keyExtractor(item, index) : index },
              renderItem({ item, index }),
            ),
          )
        : null;
      return React.createElement("mock-FlatList", { ...rest, ref }, items);
    },
  ),
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
// Expo Router — mock navigation primitives
// ---------------------------------------------------------------------------
const routerMock = {
  push: mock(() => {}),
  replace: mock(() => {}),
  back: mock(() => {}),
  canGoBack: () => true,
};

const searchParamsRef: { current: Record<string, string> } = { current: {} };

mock.module("expo-router", () => ({
  useRouter: () => routerMock,
  router: routerMock,
  usePathname: () => "/",
  useLocalSearchParams: () => searchParamsRef.current,
  Redirect: mockComponent("Redirect"),
  Slot: mockComponent("Slot"),
  Stack: Object.assign(mockComponent("Stack"), {
    Screen: mockComponent("StackScreen"),
  }),
  Link: mockComponent("Link"),
  __router: routerMock,
  __searchParams: searchParamsRef,
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
  useMutation: () => ({
    mutate: mock(() => {}),
    mutateAsync: mock(() => Promise.resolve()),
    isPending: false,
    isError: false,
    error: null,
    data: null,
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

mock.module("@trpc/tanstack-react-query", () => ({
  createTRPCOptionsProxy: () => ({}),
}));

mock.module("superjson", () => ({
  default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v },
}));

// ---------------------------------------------------------------------------
// react-native-reanimated — animation library mocks
// ---------------------------------------------------------------------------
mock.module("react-native-reanimated", () => {
  const AnimatedView = mockComponent("AnimatedView");
  const AnimatedImage = mockComponent("AnimatedImage");
  return {
    default: {
      View: AnimatedView,
      Image: AnimatedImage,
      createAnimatedComponent: (comp: unknown) => comp,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withTiming: (toValue: number) => toValue,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...args: unknown[]) => args[0],
    withSpring: (toValue: number) => toValue,
    useReducedMotion: () => false,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Easing: { bezier: () => (t: number) => t, linear: (t: number) => t, ease: (t: number) => t },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeOut: { duration: () => ({}) },
    interpolate: (value: number, inputRange: number[], outputRange: number[]) => {
      const i = inputRange.indexOf(value);
      return i >= 0 ? outputRange[i] : outputRange[0];
    },
    Extrapolation: { CLAMP: "clamp" },
  };
});

// ---------------------------------------------------------------------------
// react-native-reanimated-carousel — carousel component mock
// ---------------------------------------------------------------------------
mock.module("react-native-reanimated-carousel", () => {
  const CarouselComponent = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      const { data, renderItem, ...rest } = props as {
        data: unknown[];
        renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
        [key: string]: unknown;
      };
      React.useImperativeHandle(ref, () => ({
        scrollTo: mock(() => {}),
        getCurrentIndex: () => 0,
      }));
      const items = Array.isArray(data)
        ? data.map((item, index) =>
            React.createElement(
              "mock-CarouselPage",
              { key: index },
              renderItem({ item, index }),
            ),
          )
        : null;
      return React.createElement("mock-Carousel", rest, items);
    },
  );
  (CarouselComponent as { displayName?: string }).displayName = "Carousel";

  const PaginationBasic = (props: Record<string, unknown>) =>
    React.createElement("mock-PaginationBasic", props);

  return {
    default: CarouselComponent,
    Pagination: { Basic: PaginationBasic },
  };
});

// ---------------------------------------------------------------------------
// react-native-worklets — required by carousel
// ---------------------------------------------------------------------------
mock.module("react-native-worklets", () => ({}));

// ---------------------------------------------------------------------------
// expo-image — optimized image component mock
// ---------------------------------------------------------------------------
mock.module("expo-image", () => ({
  Image: mockComponent("ExpoImage"),
  ImageBackground: mockComponent("ExpoImageBackground"),
}));

// ---------------------------------------------------------------------------
// expo-image-picker — camera/gallery mock
// ---------------------------------------------------------------------------
mock.module("expo-image-picker", () => ({
  launchCameraAsync: mock(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: "file:///mock-camera-photo.jpg", width: 800, height: 1200 }],
    }),
  ),
  launchImageLibraryAsync: mock(() =>
    Promise.resolve({
      canceled: false,
      assets: [{ uri: "file:///mock-gallery-photo.jpg", width: 800, height: 1200 }],
    }),
  ),
  requestCameraPermissionsAsync: mock(() =>
    Promise.resolve({ status: "granted", granted: true }),
  ),
  requestMediaLibraryPermissionsAsync: mock(() =>
    Promise.resolve({ status: "granted", granted: true }),
  ),
  MediaTypeOptions: { Images: "Images", Videos: "Videos", All: "All" },
}));

// ---------------------------------------------------------------------------
// expo-haptics — haptic feedback mock
// ---------------------------------------------------------------------------
mock.module("expo-haptics", () => ({
  impactAsync: mock(() => Promise.resolve()),
  notificationAsync: mock(() => Promise.resolve()),
  selectionAsync: mock(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// ---------------------------------------------------------------------------
// @react-native-async-storage/async-storage — in-memory mock
// ---------------------------------------------------------------------------
const asyncStore = new Map<string, string>();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mock(async (key: string) => asyncStore.get(key) ?? null),
    setItem: mock(async (key: string, value: string) => { asyncStore.set(key, value); }),
    removeItem: mock(async (key: string) => { asyncStore.delete(key); }),
    clear: mock(async () => { asyncStore.clear(); }),
    getAllKeys: mock(async () => [...asyncStore.keys()]),
  },
  __asyncStore: asyncStore,
}));

// ---------------------------------------------------------------------------
// better-auth/client/plugins — anonymousClient plugin import
// ---------------------------------------------------------------------------
mock.module("better-auth/client/plugins", () => ({
  anonymousClient: () => ({ id: "anonymousClient" }),
}));
