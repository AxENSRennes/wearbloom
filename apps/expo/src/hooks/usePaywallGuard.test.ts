import { describe, expect, mock, test, beforeEach } from "bun:test";

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
mock.module("~/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => subscriptionStatusState,
}));

mock.module("expo-router", () => ({
  useRouter: () => routerMock,
  router: routerMock,
  usePathname: () => "/",
  useLocalSearchParams: () => ({}),
}));

const { usePaywallGuard } = await import("./usePaywallGuard");

// ---------------------------------------------------------------------------
// Minimal hook runner — calls the hook inside a sync render context
// ---------------------------------------------------------------------------
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

function runHook(): ReturnType<typeof usePaywallGuard> {
  let result!: ReturnType<typeof usePaywallGuard>;
  function TestComponent() {
    result = usePaywallGuard();
    return null;
  }
  renderToStaticMarkup(React.createElement(TestComponent));
  return result;
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
