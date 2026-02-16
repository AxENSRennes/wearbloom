import { describe, expect, mock, test } from "bun:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Re-mock @tanstack/react-query with an instrumented useMutation
// that tracks calls and captures onSuccess callbacks for behavioral tests.
// ---------------------------------------------------------------------------
interface MutationResult {
  mutate: ReturnType<typeof mock>;
  mutateAsync: ReturnType<typeof mock>;
  isPending: boolean;
  isError: boolean;
  error: null;
  data: null;
}

interface UseMutationCall {
  opts: Record<string, unknown>;
  result: MutationResult;
}

const useMutationCalls: UseMutationCall[] = [];
const onSuccessCallbacks: (() => Promise<void>)[] = [];

function resetMutationTracking() {
  useMutationCalls.length = 0;
  onSuccessCallbacks.length = 0;
}

mock.module("@tanstack/react-query", () => ({
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useMutation: (opts?: Record<string, unknown>) => {
    const mutateAsyncMock = mock(() => Promise.resolve());
    const result: MutationResult = {
      mutate: mock(() => {}),
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
      data: null,
    };

    if (opts && typeof opts === "object") {
      useMutationCalls.push({ opts, result });

      // If opts has mutationFn, it's the auth mutation — capture onSuccess
      if ("mutationFn" in opts && typeof opts.onSuccess === "function") {
        onSuccessCallbacks.push(opts.onSuccess as () => Promise<void>);
      }
    }

    return result;
  },
  useQuery: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    isPending: false,
    isFetching: false,
  }),
}));

// Dynamic import to pick up re-mocked module bindings
const { default: SignInScreen } = await import("./sign-in");
const { showToast } = await import("@acme/ui");

function assertDefined<T>(
  val: T | undefined,
  msg = "Expected value to be defined",
): asserts val is T {
  if (val === undefined) throw new Error(msg);
}

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("SignInScreen", () => {
  test("exports a function component", () => {
    expect(typeof SignInScreen).toBe("function");
  });

  test("renders Welcome Back heading", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Welcome Back");
  });

  test("renders email input with accessibility label", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Email address");
  });

  test("renders password input with accessibility label", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Password");
  });

  test("renders Sign In button", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Sign In");
  });

  test("renders create account link", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Create one");
  });

  test("renders Apple sign-in button on iOS", () => {
    const html = render(createElement(SignInScreen));
    // Platform.OS is mocked as "ios" in test setup
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("renders email divider text", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("or continue with email");
  });

  test("does not render confirm password field", () => {
    const html = render(createElement(SignInScreen));
    // Count password-related inputs - should only be one
    const passwordMatches = html.match(/secureTextEntry/g);
    // Only one secure text entry (password, no confirm password)
    expect(passwordMatches?.length ?? 0).toBeLessThanOrEqual(1);
  });
});

describe("SignInScreen credit grant behavior", () => {
  test("calls grantCredits.mutateAsync after successful sign-in", async () => {
    resetMutationTracking();
    render(createElement(SignInScreen));

    // useMutation is called twice: first for grantCredits, second for emailSignIn
    expect(useMutationCalls.length).toBeGreaterThanOrEqual(2);

    const grantCreditsMutation = useMutationCalls[0];
    assertDefined(grantCreditsMutation, "grantCreditsMutation should exist");
    const authMutation = useMutationCalls[1];
    assertDefined(authMutation, "authMutation should exist");

    // The auth mutation should have mutationFn and onSuccess
    expect(authMutation.opts).toHaveProperty("mutationFn");
    expect(authMutation.opts).toHaveProperty("onSuccess");

    // Invoke onSuccess (simulating successful sign-in)
    expect(onSuccessCallbacks.length).toBeGreaterThan(0);
    const onSuccessCb = onSuccessCallbacks[0];
    assertDefined(onSuccessCb, "onSuccess callback should exist");
    await onSuccessCb();

    // grantCredits.mutateAsync should have been called
    expect(grantCreditsMutation.result.mutateAsync).toHaveBeenCalled();
  });

  test("silently catches credit grant failure on sign-in (idempotent)", async () => {
    resetMutationTracking();

    // Clear any previous showToast calls
    (showToast as ReturnType<typeof mock>).mockClear();

    // Re-render to get fresh mutation tracking
    render(createElement(SignInScreen));

    // Make the grantCredits.mutateAsync reject
    const grantCreditsMutation = useMutationCalls[0];
    assertDefined(grantCreditsMutation, "grantCreditsMutation should exist");
    (grantCreditsMutation.result.mutateAsync as ReturnType<typeof mock>).mockImplementation(
      () => Promise.reject(new Error("grant failed")),
    );

    // Invoke onSuccess (simulating successful sign-in, but credit grant will fail)
    // This should NOT throw — the catch block is silent
    const onSuccessCb = onSuccessCallbacks[0];
    assertDefined(onSuccessCb, "onSuccess callback should exist");
    await onSuccessCb();

    // showToast should NOT have been called — sign-in silently catches the error
    expect(showToast).not.toHaveBeenCalled();
  });
});
