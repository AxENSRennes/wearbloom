import { createElement } from "react";
import type { ReactElement } from "react";
// @ts-expect-error -- __searchParams is a test-only export from expo-router mock
import { __searchParams } from "expo-router";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
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

const { QueryClient, QueryClientProvider, useQuery, useQueryClient } =
  await import("@tanstack/react-query");
void mock.module("@tanstack/react-query", () => ({
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
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
}));

// Dynamic import to pick up re-mocked module bindings
const { default: SignUpScreen } = await import("./sign-up");
const { showToast } = await import("@acme/ui");

function assertDefined<T>(
  val: T | undefined,
  msg = "Expected value to be defined",
): asserts val is T {
  if (val === undefined) throw new Error(msg);
}

function render(component: ReactElement) {
  return renderToStaticMarkup(component);
}

const searchParams = __searchParams as { current: Record<string, string> };

describe("SignUpScreen (normal context)", () => {
  beforeEach(() => {
    searchParams.current = {};
  });

  test("exports a function component", () => {
    expect(typeof SignUpScreen).toBe("function");
  });

  test("renders Create Account heading", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Create Account");
  });

  test("renders name input with accessibility label", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Full name");
  });

  test("renders email input with accessibility label", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Email address");
  });

  test("renders password input", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Password");
  });

  test("renders Apple sign-up button on iOS", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("renders sign in link", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Already have an account");
  });

  test("renders email divider text", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("or sign up with email");
  });

  test("does not render confirm password field", () => {
    const html = render(createElement(SignUpScreen));
    const passwordMatches = html.match(/secureTextEntry/g);
    expect(passwordMatches?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test("does not show benefit messaging", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).not.toContain("free try-ons");
  });

  test("does not show Skip for now button", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).not.toContain("Skip for now");
  });
});

describe("SignUpScreen (onboarding context)", () => {
  beforeEach(() => {
    searchParams.current = { from: "onboarding" };
  });

  afterEach(() => {
    searchParams.current = {};
  });

  test("renders Create Free Account heading", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Create Free Account");
  });

  test("shows benefit messaging", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("free try-ons");
  });

  test("shows Skip for now button instead of sign-in link", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("Already have an account");
  });

  test("Skip for now button has accessibility hint", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Returns to onboarding to try more combinations");
  });

  test("benefit messaging has accessibility role", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("accessibilityRole");
  });

  test("still renders form fields", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Full name");
    expect(html).toContain("Email address");
    expect(html).toContain("Password");
  });

  test("still renders Apple sign-up button", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("passes onboarding completion callback to Apple Sign-In hook", async () => {
    const source = await Bun.file(import.meta.dir + "/sign-up.tsx").text();
    // useAppleSignIn should receive onSuccess with markOnboardingComplete for onboarding context
    const hookCallIndex = source.indexOf("useAppleSignIn(");
    const hookSection = source.substring(hookCallIndex, hookCallIndex + 300);
    expect(hookSection).toContain("markOnboardingComplete");
    expect(hookSection).toContain("onSuccess");
  });
});

describe("SignUpScreen credit grant behavior", () => {
  test("calls grantCredits.mutateAsync after successful sign-up", async () => {
    resetMutationTracking();
    render(createElement(SignUpScreen));

    // useMutation is called twice: first for grantCredits, second for emailSignUp
    expect(useMutationCalls.length).toBeGreaterThanOrEqual(2);

    const grantCreditsMutation = useMutationCalls[0];
    assertDefined(grantCreditsMutation, "grantCreditsMutation should exist");
    const authMutation = useMutationCalls[1];
    assertDefined(authMutation, "authMutation should exist");

    // The auth mutation should have mutationFn and onSuccess
    expect(authMutation.opts).toHaveProperty("mutationFn");
    expect(authMutation.opts).toHaveProperty("onSuccess");

    // Invoke onSuccess (simulating successful sign-up)
    expect(onSuccessCallbacks.length).toBeGreaterThan(0);
    const onSuccessCb = onSuccessCallbacks[0];
    assertDefined(onSuccessCb, "onSuccess callback should exist");
    await onSuccessCb();

    // grantCredits.mutateAsync should have been called
    expect(grantCreditsMutation.result.mutateAsync).toHaveBeenCalled();
  });

  test("shows info toast when credit grant fails after sign-up", async () => {
    resetMutationTracking();

    // Clear any previous showToast calls
    (showToast as ReturnType<typeof mock>).mockClear();

    // Re-render to get fresh mutation tracking
    render(createElement(SignUpScreen));

    // Make the grantCredits.mutateAsync reject
    const grantCreditsMutation = useMutationCalls[0];
    assertDefined(grantCreditsMutation, "grantCreditsMutation should exist");
    grantCreditsMutation.result.mutateAsync.mockImplementation(() =>
      Promise.reject(new Error("grant failed")),
    );

    // Invoke onSuccess (simulating successful sign-up, but credit grant will fail)
    const onSuccessCb = onSuccessCallbacks[0];
    assertDefined(onSuccessCb, "onSuccess callback should exist");
    await onSuccessCb();

    // showToast should have been called with the info fallback message
    expect(showToast).toHaveBeenCalledWith({
      message: "Credits will be granted later",
      variant: "info",
    });
  });
});
