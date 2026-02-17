import { plugin } from "bun";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { mock } from "bun:test";

// Register DOM globals (document, window, HTMLElement, etc.) for behavioral tests
// This is safe for SSR tests — renderToStaticMarkup works with or without DOM globals.
GlobalRegistrator.register();

// Tell React that we're inside a test environment so act() warnings are suppressed
// @ts-expect-error -- IS_REACT_ACT_ENVIRONMENT is a global checked by React internals
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Image asset loader — Metro resolves require("*.png") to numeric IDs at build
// time. Bun doesn't understand binary image files, so intercept and return a
// mock numeric ID for each image.
// ---------------------------------------------------------------------------
let imageIdCounter = 1;
plugin({
  name: "image-loader",
  setup(build) {
    build.onLoad({ filter: /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/ }, () => ({
      contents: `export default ${imageIdCounter++};`,
      loader: "js",
    }));
  },
});

// Define globals normally provided by Metro/React Native bundler
// @ts-expect-error -- __DEV__ is a global set by Metro bundler
globalThis.__DEV__ = true;
globalThis.process.env.EXPO_OS = "ios";
// @ts-expect-error -- expo global is set by expo-modules-core native runtime
globalThis.expo = {
  EventEmitter: class MockEventEmitter {
    addListener() {
      return { remove: () => {} };
    }
    removeListener() {}
    removeAllListeners() {}
    emit() {}
    listenerCount() {
      return 0;
    }
  },
  modules: {},
  uuidv4: () => "mock-uuid",
  uuidv5: () => "mock-uuid",
  getViewConfig: () => ({ validAttributes: {}, directEventTypes: {} }),
};

const React = await import("react");

// ---------------------------------------------------------------------------
// react-native-mmkv — in-memory Map simulating MMKV
// ---------------------------------------------------------------------------
const mmkvStore = new Map<string, string>();

void mock.module("react-native-mmkv", () => ({
  createMMKV: mock(() => ({
    getString: mock((key: string) => mmkvStore.get(key) ?? undefined),
    set: mock((key: string, value: string) => {
      mmkvStore.set(key, value);
    }),
    remove: mock((key: string) => {
      mmkvStore.delete(key);
      return true;
    }),
    contains: mock((key: string) => mmkvStore.has(key)),
    clearAll: mock(() => {
      mmkvStore.clear();
    }),
  })),
}));

// ---------------------------------------------------------------------------
// expo-secure-store — in-memory mock for consent/session storage
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

void mock.module("expo-secure-store", () => ({
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

void mock.module("react-native", () => ({
  View: mockComponent("View"),
  Text: mockComponent("Text"),
  TextInput: mockComponent("TextInput"),
  ScrollView: mockComponent("ScrollView"),
  Pressable: mockComponent("Pressable"),
  TouchableOpacity: mockComponent("TouchableOpacity"),
  ActivityIndicator: mockComponent("ActivityIndicator"),
  Image: mockComponent("Image"),
  Modal: mockComponent("Modal"),
  FlatList: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    const { data, renderItem, keyExtractor, ...rest } = props as {
      data?: unknown[];
      renderItem?: (info: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
      [key: string]: unknown;
    };
    const items =
      Array.isArray(data) && renderItem
        ? data.map((item, index) =>
            React.createElement(
              "mock-FlatListItem",
              { key: keyExtractor ? keyExtractor(item, index) : index },
              renderItem({ item, index }),
            ),
          )
        : null;
    return React.createElement("mock-FlatList", { ...rest, ref }, items);
  }),
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
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    listenerCount() {
      return 0;
    }
  },
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  },
  PixelRatio: { get: () => 2, getPixelSizeForLayoutSize: (s: number) => s * 2 },
  Appearance: {
    getColorScheme: () => "light",
    addChangeListener: () => ({ remove: () => {} }),
  },
  Linking: {
    openURL: mock(() => Promise.resolve()),
    canOpenURL: mock(() => Promise.resolve(true)),
  },
  Alert: { alert: mock(() => {}) },
  I18nManager: { isRTL: false },
  StatusBar: mockComponent("RNStatusBar"),
  useWindowDimensions: () => ({ width: 375, height: 812 }),
  useColorScheme: () => "light",
  processColor: (color: unknown) => color,
}));

void mock.module("react-native-safe-area-context", () => ({
  SafeAreaView: mockComponent("SafeAreaView"),
  SafeAreaProvider: mockComponent("SafeAreaProvider"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------
// Gluestack UI — mock core and utils (required by @acme/ui)
// ---------------------------------------------------------------------------
void mock.module("@gluestack-ui/core", () => ({
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

void mock.module("@gluestack-ui/utils/nativewind-utils", () => ({
  tva:
    (config: Record<string, unknown>) => (props: Record<string, unknown>) => {
      const base = (config.base as string | undefined) ?? "";
      const variants = config.variants as
        | Record<string, Record<string, string>>
        | undefined;
      const defaultVariants = config.defaultVariants as
        | Record<string, string>
        | undefined;
      let cls = base;
      if (variants) {
        for (const [key, map] of Object.entries(variants)) {
          const val =
            (props[key] as string | undefined) ??
            defaultVariants?.[key];
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
void mock.module("expo-constants", () => ({
  default: {
    expoConfig: {
      hostUri: "localhost:3000",
    },
  },
}));

// ---------------------------------------------------------------------------
// expo-haptics — mock haptic feedback
// ---------------------------------------------------------------------------
void mock.module("expo-haptics", () => ({
  impactAsync: mock(() => Promise.resolve()),
  notificationAsync: mock(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: "Light",
    Medium: "Medium",
    Heavy: "Heavy",
  },
  NotificationFeedbackType: {
    Success: "Success",
    Warning: "Warning",
    Error: "Error",
  },
}));

// ---------------------------------------------------------------------------
// expo-image-picker — mock camera and gallery pickers
// ---------------------------------------------------------------------------
void mock.module("expo-image-picker", () => ({
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
void mock.module("expo-image-manipulator", () => ({
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

const searchParamsRef: { current: Record<string, string> } = { current: { id: "mock-render-id" } };

void mock.module("expo-router", () => ({
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
// expo-image — mock Image component for auth-gated image loading
// ---------------------------------------------------------------------------
void mock.module("expo-image", () => ({
  Image: mockComponent("ExpoImage"),
}));

// ---------------------------------------------------------------------------
// lucide-react-native — mock icons as simple components
// ---------------------------------------------------------------------------
void mock.module("lucide-react-native", () => ({
  Camera: mockComponent("Icon-Camera"),
  Home: mockComponent("Icon-Home"),
  ImageIcon: mockComponent("Icon-ImageIcon"),
  Plus: mockComponent("Icon-Plus"),
  User: mockComponent("Icon-User"),
  ChevronRight: mockComponent("Icon-ChevronRight"),
  ArrowLeft: mockComponent("Icon-ArrowLeft"),
  Check: mockComponent("Icon-Check"),
  X: mockComponent("Icon-X"),
  CircleCheck: mockComponent("Icon-CircleCheck"),
  MessageCircle: mockComponent("Icon-MessageCircle"),
  ThumbsUp: mockComponent("Icon-ThumbsUp"),
  ThumbsDown: mockComponent("Icon-ThumbsDown"),
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

void mock.module("better-auth/react", () => ({
  createAuthClient: () => mockAuthClient,
}));

void mock.module("@better-auth/expo/client", () => ({
  expoClient: () => ({ id: "expoClient" }),
}));

// ---------------------------------------------------------------------------
// expo-apple-authentication — mock Apple Sign-In SDK
// ---------------------------------------------------------------------------
void mock.module("expo-apple-authentication", () => ({
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
void mock.module("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    _defaultOptions: Record<string, unknown>;
    constructor(opts?: { defaultOptions?: Record<string, unknown> }) {
      this._defaultOptions = opts?.defaultOptions ?? {};
    }
    getDefaultOptions() {
      return this._defaultOptions;
    }
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
void mock.module("@expo-google-fonts/dm-serif-display", () => ({
  useFonts: () => [true, null],
  DMSerifDisplay_400Regular: "DMSerifDisplay_400Regular",
}));

void mock.module("expo-splash-screen", () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => Promise.resolve(),
}));

void mock.module("expo-status-bar", () => ({
  StatusBar: ({ style: _style, ...rest }: Record<string, unknown>) =>
    React.createElement("mock-StatusBar", rest),
}));

// ---------------------------------------------------------------------------
// @acme/ui — mock all exported components and utilities
// ---------------------------------------------------------------------------
const MockButton = Object.assign(mockComponent("Button"), {
  Text: mockComponent("ButtonText"),
});
void mock.module("@acme/ui", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  tva: (config: Record<string, unknown>) => () => (config.base as string | undefined) ?? "",
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
// expo-iap — mock IAP module (native module not available in test)
// ---------------------------------------------------------------------------
void mock.module("expo-iap", () => ({
  useIAP: () => ({
    connected: false,
    subscriptions: [],
    fetchProducts: mock(() => Promise.resolve()),
    requestPurchase: mock(() => Promise.resolve()),
    finishTransaction: mock(() => Promise.resolve()),
    restorePurchases: mock(() => Promise.resolve()),
  }),
  getAvailablePurchases: mock(() => Promise.resolve([])),
  ErrorCode: {
    ActivityUnavailable: "activity-unavailable",
    AlreadyOwned: "already-owned",
    BillingUnavailable: "billing-unavailable",
    DeferredPayment: "deferred-payment",
    ItemUnavailable: "item-unavailable",
    NetworkError: "network-error",
    PurchaseError: "purchase-error",
    Unknown: "unknown",
    UserCancelled: "user-cancelled",
    UserError: "user-error",
  },
}));

// ---------------------------------------------------------------------------
// tRPC and superjson — imported transitively via ~/utils/api
// ---------------------------------------------------------------------------
void mock.module("@trpc/client", () => ({
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

void mock.module("@trpc/tanstack-react-query", () => ({
  createTRPCOptionsProxy: () => createMockTRPCProxy(),
}));

void mock.module("superjson", () => ({
  default: { serialize: (v: unknown) => v, deserialize: (v: unknown) => v },
}));

// ---------------------------------------------------------------------------
// react-native-gesture-handler — mock GestureHandlerRootView and gestures
// ---------------------------------------------------------------------------
void mock.module("react-native-gesture-handler", () => {
  function createChainableGesture() {
    const gesture: Record<string, unknown> = {};
    const methods = ["onBegin", "onUpdate", "onEnd", "onStart", "onFinalize", "minDistance", "activeOffsetY", "failOffsetX"];
    for (const method of methods) {
      gesture[method] = () => gesture;
    }
    return gesture;
  }

  return {
    GestureHandlerRootView: mockComponent("GestureHandlerRootView"),
    Gesture: {
      Pan: () => createChainableGesture(),
      Tap: () => createChainableGesture(),
    },
      GestureDetector: mockComponent("GestureDetector"),
    Swipeable: mockComponent("Swipeable"),
    DrawerLayout: mockComponent("DrawerLayout"),
    State: {},
    PanGestureHandler: mockComponent("PanGestureHandler"),
    TapGestureHandler: mockComponent("TapGestureHandler"),
    FlingGestureHandler: mockComponent("FlingGestureHandler"),
    ForceTouchGestureHandler: mockComponent("ForceTouchGestureHandler"),
    LongPressGestureHandler: mockComponent("LongPressGestureHandler"),
    ScrollView: mockComponent("GHScrollView"),
    FlatList: mockComponent("GHFlatList"),
  };
});

// ---------------------------------------------------------------------------
// @gorhom/bottom-sheet — mock BottomSheet component with ref methods
// ---------------------------------------------------------------------------
void mock.module("@gorhom/bottom-sheet", () => {
  const BottomSheet = React.forwardRef(
    (allProps: Record<string, unknown>, ref: React.Ref<unknown>) => {
      const { children, onChange, backdropComponent, handleComponent, ...props } = allProps;
      const onChangeFn = onChange as ((index: number) => void) | undefined;
      const backdropFn = backdropComponent as ((props: Record<string, unknown>) => React.ReactNode) | undefined;
      const handleFn = handleComponent as ((props: Record<string, unknown>) => React.ReactNode) | undefined;
      React.useImperativeHandle(ref, () => ({
        snapToIndex: mock((index: number) => onChangeFn?.(index)),
        close: mock(() => onChangeFn?.(-1)),
        expand: mock(() => {}),
        collapse: mock(() => {}),
      }));
      const backdrop = backdropFn
        ? backdropFn({ animatedIndex: { value: 0 }, animatedPosition: { value: 0 } })
        : null;
      const handle = handleFn
        ? handleFn({})
        : null;
      return React.createElement("mock-BottomSheet", props, backdrop, handle, children as React.ReactNode);
    },
  );
  BottomSheet.displayName = "BottomSheet";

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement("mock-BottomSheetView", props, children as React.ReactNode),
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement("mock-BottomSheetBackdrop", props),
    BottomSheetScrollView: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement("mock-BottomSheetScrollView", props, children as React.ReactNode),
    BottomSheetFooter: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement("mock-BottomSheetFooter", props, children as React.ReactNode),
    useBottomSheetSpringConfigs: (config: Record<string, unknown>) => config,
  };
});

// ---------------------------------------------------------------------------
// react-native-reanimated — mock animation hooks for press/skeleton animations
// ---------------------------------------------------------------------------
void mock.module("react-native-reanimated", () => {
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
    useSharedValue: (initial: number) => {
      const ref = React.useRef({ value: initial });
      return ref.current;
    },
    useAnimatedStyle: (updater: () => Record<string, unknown>) => updater(),
    withSpring: (toValue: number, _config?: unknown, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return toValue;
    },
    withTiming: (toValue: number, _config?: unknown, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return toValue;
    },
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[0],
    useReducedMotion: () => false,
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Easing: {
      bezier: () => (t: number) => t,
      linear: (t: number) => t,
      ease: (t: number) => t,
      inOut: () => 0,
    },
    createAnimatedComponent: (comp: unknown) => comp,
    StyleSheet: {
      absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeOut: { duration: () => ({}) },
    interpolate: (
      value: number,
      inputRange: number[],
      outputRange: number[],
    ) => {
      const i = inputRange.indexOf(value);
      return i >= 0 ? outputRange[i] : outputRange[0];
    },
    Extrapolation: { CLAMP: "clamp" },
  };
});

// ---------------------------------------------------------------------------
// @legendapp/list — mock LegendList as a basic list renderer
// ---------------------------------------------------------------------------
void mock.module("@legendapp/list", () => ({
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
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
        : null;

      const header = ListHeaderComponent
        ? typeof ListHeaderComponent === "function"
          ? React.createElement(ListHeaderComponent)
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

// ---------------------------------------------------------------------------
// @react-native-community/netinfo — default to connected
// ---------------------------------------------------------------------------
void mock.module("@react-native-community/netinfo", () => ({
  useNetInfo: mock(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  })),
  addEventListener: mock(() => mock(() => {})),
  fetch: mock(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
  default: {
    useNetInfo: mock(() => ({
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    })),
    addEventListener: mock(() => mock(() => {})),
    fetch: mock(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
}));

// ---------------------------------------------------------------------------
// react-native-reanimated-carousel — carousel component mock
// ---------------------------------------------------------------------------
void mock.module("react-native-reanimated-carousel", () => {
  const CarouselComponent = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
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
void mock.module("react-native-worklets", () => ({}));

// ---------------------------------------------------------------------------
// @tanstack/react-query-persist-client — mock PersistQueryClientProvider
// ---------------------------------------------------------------------------
void mock.module("@tanstack/react-query-persist-client", () => ({
  PersistQueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// ---------------------------------------------------------------------------
// @tanstack/query-sync-storage-persister — mock createSyncStoragePersister
// ---------------------------------------------------------------------------
void mock.module("@tanstack/query-sync-storage-persister", () => ({
  createSyncStoragePersister: mock(() => ({})),
}));

// ---------------------------------------------------------------------------
// @paralleldrive/cuid2 — mock ID generation
// ---------------------------------------------------------------------------
let cuidCounter = 0;
void mock.module("@paralleldrive/cuid2", () => ({
  createId: mock(() => `mock-cuid-${++cuidCounter}`),
}));

// ---------------------------------------------------------------------------
// @react-native-async-storage/async-storage — in-memory mock
// ---------------------------------------------------------------------------
const asyncStore = new Map<string, string>();
void mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mock(async (key: string) => asyncStore.get(key) ?? null),
    setItem: mock(async (key: string, value: string) => {
      asyncStore.set(key, value);
    }),
    removeItem: mock(async (key: string) => {
      asyncStore.delete(key);
    }),
    clear: mock(async () => {
      asyncStore.clear();
    }),
    getAllKeys: mock(async () => [...asyncStore.keys()]),
  },
  __asyncStore: asyncStore,
}));

// ---------------------------------------------------------------------------
// better-auth/client/plugins — anonymousClient plugin import
// ---------------------------------------------------------------------------
void mock.module("better-auth/client/plugins", () => ({
  anonymousClient: () => ({ id: "anonymousClient" }),
}));
