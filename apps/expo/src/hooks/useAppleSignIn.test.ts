import { describe, expect, mock, test, beforeEach } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
const appleSignInResult = {
  identityToken: "mock-apple-id-token" as string | null,
  fullName: {
    givenName: "Test" as string | null,
    familyName: "User" as string | null,
  } as { givenName: string | null; familyName: string | null } | null,
  email: "test@privaterelay.appleid.com",
};

const signInAsyncMock = mock(() => Promise.resolve(appleSignInResult));

mock.module("expo-apple-authentication", () => ({
  signInAsync: signInAsyncMock,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
}));

// ---------------------------------------------------------------------------
// Mock auth client
// ---------------------------------------------------------------------------
const socialSignInMock = mock(() =>
  Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
);
const updateUserMock = mock(() => Promise.resolve({ data: null, error: null }));

mock.module("~/utils/auth", () => ({
  authClient: {
    signIn: { social: socialSignInMock },
    updateUser: updateUserMock,
    getCookie: () => null,
  },
}));

// ---------------------------------------------------------------------------
// Mock router
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
  useLocalSearchParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// Mock showToast
// ---------------------------------------------------------------------------
const showToastMock = mock(() => {});
mock.module("@acme/ui", () => ({
  showToast: showToastMock,
}));

// ---------------------------------------------------------------------------
// Mock tRPC + TanStack Query — grant credits mutation
// ---------------------------------------------------------------------------
const grantCreditsMutateAsync = mock(() => Promise.resolve());

// Track useMutation calls: first call is grantCredits, second is the hook's own mutation
let useMutationCallIndex = 0;
let onSuccessCb: (() => Promise<void>) | undefined;
let onErrorCb: ((error: Error) => void) | undefined;
let mutationFnCapture: (() => Promise<unknown>) | undefined;

mock.module("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useMutation: (opts?: {
    mutationFn?: () => Promise<unknown>;
    onSuccess?: () => Promise<void>;
    onError?: (error: Error) => void;
  }) => {
    const idx = useMutationCallIndex++;
    if (idx % 2 === 0) {
      // First call: grantCredits mutation (from mutationOptions)
      return {
        mutate: mock(() => {}),
        mutateAsync: grantCreditsMutateAsync,
        isPending: false,
        isError: false,
        error: null,
      };
    }
    // Second call: the hook's own useMutation with mutationFn/onSuccess/onError
    if (opts) {
      onSuccessCb = opts.onSuccess;
      onErrorCb = opts.onError;
      mutationFnCapture = opts.mutationFn;
    }
    return {
      mutate: mock(() => {}),
      mutateAsync: mock(() => Promise.resolve()),
      isPending: false,
      isError: false,
      error: null,
    };
  },
  useQuery: () => ({
    data: null,
    isLoading: false,
    isPending: false,
  }),
}));

// Mock tRPC proxy
function createTrpcProxy(): unknown {
  const handler: ProxyHandler<CallableFunction> = {
    get: (_target, prop) => {
      if (prop === "queryOptions" || prop === "mutationOptions") {
        return () => ({});
      }
      if (prop === "queryKey") {
        return ["mock-query-key"];
      }
      return createTrpcProxy();
    },
    apply: () => ({}),
  };
  return new Proxy(() => {}, handler);
}

mock.module("~/utils/api", () => ({
  trpc: createTrpcProxy(),
  queryClient: { invalidateQueries: mock(() => Promise.resolve()) },
}));

// ---------------------------------------------------------------------------
// Import the hook under test AFTER all mocks are in place
// ---------------------------------------------------------------------------
const { useAppleSignIn } = await import("./useAppleSignIn");

// ---------------------------------------------------------------------------
// Assertion helper for type-safe undefined checks
// ---------------------------------------------------------------------------
function assertDefined<T>(
  val: T | undefined,
  msg = "Expected value to be defined",
): asserts val is T {
  if (val === undefined) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Minimal hook runner
// ---------------------------------------------------------------------------
function runHook(
  options?: Parameters<typeof useAppleSignIn>[0],
): ReturnType<typeof useAppleSignIn> {
  let result: ReturnType<typeof useAppleSignIn> | undefined;
  function TestComponent() {
    result = useAppleSignIn(options);
    return null;
  }
  renderToStaticMarkup(React.createElement(TestComponent));
  assertDefined(result, "Hook must produce a result after render");
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useAppleSignIn", () => {
  beforeEach(() => {
    useMutationCallIndex = 0;
    onSuccessCb = undefined;
    onErrorCb = undefined;
    mutationFnCapture = undefined;

    appleSignInResult.identityToken = "mock-apple-id-token";
    appleSignInResult.fullName = { givenName: "Test", familyName: "User" };

    signInAsyncMock.mockClear();
    socialSignInMock.mockClear();
    updateUserMock.mockClear();
    routerMock.replace.mockClear();
    showToastMock.mockClear();
    grantCreditsMutateAsync.mockClear();

    socialSignInMock.mockImplementation(() =>
      Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
    );
  });

  test("returns a mutation object with expected shape", () => {
    const result = runHook();

    expect(result).toHaveProperty("mutate");
    expect(result).toHaveProperty("mutateAsync");
    expect(result).toHaveProperty("isPending");
    expect(result).toHaveProperty("isError");
    expect(result.isPending).toBe(false);
  });

  test("mutationFn calls Apple signInAsync with correct scopes", async () => {
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(signInAsyncMock).toHaveBeenCalledWith({
      requestedScopes: [0, 1], // FULL_NAME=0, EMAIL=1
    });
  });

  test("mutationFn calls authClient.signIn.social with identity token", async () => {
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(socialSignInMock).toHaveBeenCalledWith({
      provider: "apple",
      idToken: { token: "mock-apple-id-token" },
    });
  });

  test("mutationFn throws when identityToken is null", async () => {
    appleSignInResult.identityToken = null;
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await expect(mutationFnCapture()).rejects.toThrow(
      "No identity token received from Apple",
    );
  });

  test("mutationFn throws when social sign-in returns error", async () => {
    socialSignInMock.mockImplementation(() =>
      Promise.resolve({
        data: null,
        error: { message: "Auth server error" },
      }),
    );
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await expect(mutationFnCapture()).rejects.toThrow("Auth server error");
  });

  test("mutationFn captures full name on first sign-in", async () => {
    appleSignInResult.fullName = {
      givenName: "Jane",
      familyName: "Doe",
    };
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(updateUserMock).toHaveBeenCalledWith({ name: "Jane Doe" });
  });

  test("mutationFn skips name update when fullName is null", async () => {
    appleSignInResult.fullName = null;
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test("mutationFn skips name update when both names are empty", async () => {
    appleSignInResult.fullName = { givenName: null, familyName: null };
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test("mutationFn handles only givenName present", async () => {
    appleSignInResult.fullName = { givenName: "Jane", familyName: null };
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    await mutationFnCapture();

    expect(updateUserMock).toHaveBeenCalledWith({ name: "Jane" });
  });

  test("mutationFn does not throw if updateUser fails", async () => {
    updateUserMock.mockImplementation(() => {
      throw new Error("Network error");
    });
    appleSignInResult.fullName = { givenName: "Jane", familyName: "Doe" };
    runHook();
    assertDefined(mutationFnCapture, "mutationFnCapture should be set");

    // Should not reject — name update failure is non-critical
    await expect(mutationFnCapture()).resolves.toBeDefined();
  });

  test("onSuccess grants credits and navigates to auth tabs", async () => {
    runHook();
    assertDefined(onSuccessCb, "onSuccessCb should be set");

    await onSuccessCb();

    expect(grantCreditsMutateAsync).toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/(tabs)");
  });

  test("onSuccess calls custom onSuccess callback instead of default navigation", async () => {
    const customOnSuccess = mock(() => Promise.resolve());
    runHook({ onSuccess: customOnSuccess });
    assertDefined(onSuccessCb, "onSuccessCb should be set");

    await onSuccessCb();

    expect(grantCreditsMutateAsync).toHaveBeenCalled();
    expect(customOnSuccess).toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  test("onSuccess navigates even if grantCredits fails", async () => {
    grantCreditsMutateAsync.mockImplementation(() =>
      Promise.reject(new Error("Already granted")),
    );
    runHook();
    assertDefined(onSuccessCb, "onSuccessCb should be set");

    await onSuccessCb();

    expect(routerMock.replace).toHaveBeenCalledWith("/(auth)/(tabs)");
  });

  test("onError shows toast for non-cancel errors", () => {
    runHook();
    assertDefined(onErrorCb, "onErrorCb should be set");

    onErrorCb(new Error("Network timeout"));

    expect(showToastMock).toHaveBeenCalledWith({
      message: "Network timeout",
      variant: "error",
    });
  });

  test("onError silently ignores user cancellation", () => {
    runHook();
    assertDefined(onErrorCb, "onErrorCb should be set");

    onErrorCb(new Error("The operation was canceled"));

    expect(showToastMock).not.toHaveBeenCalled();
  });

  test("onError silently ignores ERR_REQUEST_CANCELED", () => {
    runHook();
    assertDefined(onErrorCb, "onErrorCb should be set");

    onErrorCb(new Error("ERR_REQUEST_CANCELED"));

    expect(showToastMock).not.toHaveBeenCalled();
  });
});
