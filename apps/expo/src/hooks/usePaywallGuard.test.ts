// ---------------------------------------------------------------------------
// Minimal hook runner — calls the hook inside a sync render context
// ---------------------------------------------------------------------------
import React from "react";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
const subscriptionStatusState = {
  canRender: true,
  isSubscriber: false,
  creditsRemaining: 3,
  state: "free_with_credits" as string,
  isLoading: false,
};

const routerMock = {
  push: mock(() => {}),
  replace: mock(() => {}),
  back: mock(() => {}),
  canGoBack: () => true,
};

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------
void mock.module("~/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => subscriptionStatusState,
}));

const _routerBase = await import("expo-router");
void mock.module("expo-router", () => ({
  ..._routerBase,
  useRouter: () => routerMock,
  router: routerMock,
}));

const { usePaywallGuard } = await import("./usePaywallGuard");

function runHook(): ReturnType<typeof usePaywallGuard> {
  const resultRef = {
    current: undefined as ReturnType<typeof usePaywallGuard> | undefined,
  };
  function TestComponent() {
    // eslint-disable-next-line react-hooks/immutability -- test-only hook runner, not a real component
    resultRef.current = usePaywallGuard();
    return null;
  }
  renderToStaticMarkup(React.createElement(TestComponent));
  if (!resultRef.current)
    throw new Error("Hook must produce a result after render");
  return resultRef.current;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePaywallGuard", () => {
  beforeEach(() => {
    subscriptionStatusState.canRender = true;
    subscriptionStatusState.isSubscriber = false;
    subscriptionStatusState.creditsRemaining = 3;
    subscriptionStatusState.state = "free_with_credits";
    routerMock.push.mockClear();
  });

  test("guardRender returns true when canRender is true", () => {
    subscriptionStatusState.canRender = true;
    const { guardRender } = runHook();
    expect(guardRender("garment-1")).toBe(true);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test("guardRender returns true when user is subscriber", () => {
    subscriptionStatusState.canRender = false;
    subscriptionStatusState.isSubscriber = true;
    const { guardRender } = runHook();
    expect(guardRender("garment-1")).toBe(true);
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  test("guardRender returns false and navigates to paywall when blocked", () => {
    subscriptionStatusState.canRender = false;
    subscriptionStatusState.isSubscriber = false;
    const { guardRender } = runHook();
    expect(guardRender("garment-42")).toBe(false);
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: "/(auth)/paywall",
      params: { garmentId: "garment-42" },
    });
  });
});
