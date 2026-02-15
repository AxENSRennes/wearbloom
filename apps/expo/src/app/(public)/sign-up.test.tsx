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
const onSuccessCallbacks: Array<() => Promise<void>> = [];

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
const { default: SignUpScreen } = await import("./sign-up");
const { showToast } = await import("@acme/ui");

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("SignUpScreen", () => {
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
});

describe("SignUpScreen credit grant behavior", () => {
  test("calls grantCredits.mutateAsync after successful sign-up", async () => {
    resetMutationTracking();
    render(createElement(SignUpScreen));

    // useMutation is called twice: first for grantCredits, second for emailSignUp
    expect(useMutationCalls.length).toBeGreaterThanOrEqual(2);

    const grantCreditsMutation = useMutationCalls[0]!;
    const authMutation = useMutationCalls[1]!;

    // The auth mutation should have mutationFn and onSuccess
    expect(authMutation.opts).toHaveProperty("mutationFn");
    expect(authMutation.opts).toHaveProperty("onSuccess");

    // Invoke onSuccess (simulating successful sign-up)
    expect(onSuccessCallbacks.length).toBeGreaterThan(0);
    await onSuccessCallbacks[0]!();

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
    const grantCreditsMutation = useMutationCalls[0]!;
    (grantCreditsMutation.result.mutateAsync as ReturnType<typeof mock>).mockImplementation(
      () => Promise.reject(new Error("grant failed")),
    );

    // Invoke onSuccess (simulating successful sign-up, but credit grant will fail)
    await onSuccessCallbacks[0]!();

    // showToast should have been called with the info fallback message
    expect(showToast).toHaveBeenCalledWith({
      message: "Credits will be granted later",
      variant: "info",
    });
  });
});
