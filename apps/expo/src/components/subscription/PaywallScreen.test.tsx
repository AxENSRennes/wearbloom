import React from "react";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { PaywallScreenProps } from "./PaywallScreen";

// ---------------------------------------------------------------------------
// NOTE: renderToStaticMarkup cannot test interaction handlers (onPress, etc.).
// purchase() and restore() handler wiring is verified by TypeScript type-check
// (handlers are passed inline) and will be covered by E2E tests.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mutable mock state — updated per test, read by mocked hooks
// ---------------------------------------------------------------------------
const storeKitState = {
  purchase: mock(() => Promise.resolve()),
  restore: mock(() => Promise.resolve({ restored: 1 })),
  isPurchasing: false,
  isRestoring: false,
  product: {
    productId: "com.wearbloom.weekly",
    displayPrice: "$4.99",
    subscriptionOffers: [
      { paymentMode: "free-trial", period: { unit: "day", value: 7 } },
    ],
  } as Record<string, unknown> | null,
  isReady: true,
  connected: true,
  purchaseError: null as { code: string; message: string } | null,
  verifyError: null as Error | null,
};

const subscriptionState = {
  refetch: mock(() => Promise.resolve()),
};

// ---------------------------------------------------------------------------
// Mock hooks — MUST be before PaywallScreen import (irreversible)
// ---------------------------------------------------------------------------
void mock.module("~/hooks/useStoreKit", () => ({
  useStoreKit: () => storeKitState,
}));

void mock.module("~/hooks/useSubscription", () => ({
  useSubscription: () => subscriptionState,
}));

// Mock auth with a session providing userId
const _authBase = await import("~/utils/auth");
void mock.module("~/utils/auth", () => ({
  ..._authBase,
  authClient: {
    ..._authBase.authClient,
    useSession: () => ({
      data: { user: { id: "test-user-id" } },
      isPending: false,
      error: null,
    }),
  },
}));

// Now import the component (after mocks are registered)
const { PaywallScreen } = await import("./PaywallScreen");

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function resetMocks() {
  storeKitState.purchase = mock(() => Promise.resolve());
  storeKitState.restore = mock(() => Promise.resolve({ restored: 1 }));
  storeKitState.isPurchasing = false;
  storeKitState.isRestoring = false;
  storeKitState.product = {
    productId: "com.wearbloom.weekly",
    displayPrice: "$4.99",
    subscriptionOffers: [
      { paymentMode: "free-trial", period: { unit: "day", value: 7 } },
    ],
  };
  storeKitState.isReady = true;
  storeKitState.connected = true;
  storeKitState.purchaseError = null;
  storeKitState.verifyError = null;
  subscriptionState.refetch = mock(() => Promise.resolve());
}

function render(overrides: Partial<PaywallScreenProps> = {}): string {
  return renderToStaticMarkup(
    React.createElement(PaywallScreen, {
      onClose: mock(() => {}),
      onSuccess: mock(() => {}),
      ...overrides,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaywallScreen", () => {
  beforeEach(resetMocks);

  // --- Ready state (default) ---

  test("renders headline 'Unlimited Try-Ons' when product loaded", () => {
    const html = render();
    expect(html).toContain("Unlimited Try-Ons");
  });

  test("renders 3 benefit bullets", () => {
    const html = render();
    expect(html).toContain("See any garment on you");
    expect(html).toContain("Unlimited renders daily");
    expect(html).toContain("New AI models as added");
  });

  test("renders CTA with trial days from product", () => {
    const html = render();
    expect(html).toContain("Start Your 7-Day Free Trial");
  });

  test("renders 'Subscribe Now' CTA when no trial offer", () => {
    storeKitState.product = {
      productId: "com.wearbloom.weekly",
      displayPrice: "$4.99",
      subscriptionOffers: [],
    };
    const html = render();
    expect(html).toContain("Subscribe Now");
  });

  test("renders localized price from product.displayPrice", () => {
    const html = render();
    expect(html).toContain("$4.99");
    expect(html).toContain("/week");
  });

  test("never hardcodes price — uses product.displayPrice", () => {
    storeKitState.product = {
      productId: "com.wearbloom.weekly",
      displayPrice: "€3,99",
      subscriptionOffers: [],
    };
    const html = render();
    expect(html).toContain("€3,99");
    expect(html).not.toContain("$4.99");
  });

  test("renders Restore Purchases link", () => {
    const html = render();
    expect(html).toContain("Restore Purchases");
  });

  test("renders close button", () => {
    const html = render();
    expect(html).toContain("Close paywall");
  });

  // --- Loading state ---

  test("shows loading state when product not ready", () => {
    storeKitState.isReady = false;
    const html = render();
    // Should not show the full paywall content
    expect(html).not.toContain("Unlimited Try-Ons");
  });

  // --- Processing state ---

  test("shows processing state when isPurchasing is true", () => {
    storeKitState.isPurchasing = true;
    const html = render();
    expect(html).toContain("Confirming");
  });

  // --- Restoring state ---

  test("shows restoring indicator when isRestoring is true", () => {
    storeKitState.isRestoring = true;
    const html = render();
    expect(html).toContain("Restoring");
  });

  // --- Success state (via __testDisplayState) ---

  test("shows celebration on success", () => {
    const html = renderToStaticMarkup(
      React.createElement(PaywallScreen, {
        onClose: mock(() => {}),
        onSuccess: mock(() => {}),
        __testDisplayState: "success",
      }),
    );
    expect(html).toContain("Welcome!");
    expect(html).toContain("Try on anything");
  });

  // --- Declined state (via __testDisplayState) ---

  test("shows soft decline message on user cancel", () => {
    const html = renderToStaticMarkup(
      React.createElement(PaywallScreen, {
        onClose: mock(() => {}),
        onSuccess: mock(() => {}),
        __testDisplayState: "declined",
      }),
    );
    expect(html).toContain("No worries");
    expect(html).toContain("your wardrobe is always here");
  });

  // --- Error state (via __testDisplayState) ---

  test("shows error with retry on failure", () => {
    const html = renderToStaticMarkup(
      React.createElement(PaywallScreen, {
        onClose: mock(() => {}),
        onSuccess: mock(() => {}),
        __testDisplayState: "error",
      }),
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
  });

  // --- Accessibility ---

  test("close button has accessibility attributes", () => {
    const html = render();
    expect(html).toContain('accessibilityLabel="Close paywall"');
    expect(html).toContain('accessibilityRole="button"');
  });

  test("CTA button has accessibility label", () => {
    const html = render();
    // Mock Button renders `label` prop directly; real Button maps it to accessibilityLabel
    expect(html).toContain('label="Start Your 7-Day Free Trial"');
  });

  test("restore link has accessibility attributes", () => {
    const html = render();
    expect(html).toContain('accessibilityLabel="Restore purchases"');
    expect(html).toContain('accessibilityRole="button"');
  });

  test("benefit items have accessible text", () => {
    const html = render();
    // Check icons render with check marks next to benefit text
    expect(html).toContain("Icon-Check");
  });

  // --- Root container ---

  test("uses SafeAreaView as root container", () => {
    const html = render();
    expect(html).toMatch(/^<mock-SafeAreaView/);
  });

  test("renders price disclosure text", () => {
    const html = render();
    expect(html).toContain("Cancel anytime");
  });

  test("renders Terms and Privacy Policy links", () => {
    const html = render();
    expect(html).toContain("Terms");
    expect(html).toContain("Privacy Policy");
    expect(html).toContain('accessibilityLabel="Terms of Service"');
    expect(html).toContain('accessibilityLabel="Privacy Policy"');
  });

  test("hero image has accessibility attributes", () => {
    const html = render();
    expect(html).toContain('accessibilityRole="image"');
    expect(html).toContain('accessibilityLabel="Your try-on result preview"');
  });

  // --- garmentId passthrough ---

  test("accepts garmentId prop and renders normally", () => {
    const html = render({ garmentId: "garment-abc-123" });
    expect(html).toContain("Unlimited Try-Ons");
    expect(html).toContain("Start Your 7-Day Free Trial");
  });

  test("onSuccess callback type accepts garmentId parameter", () => {
    const onSuccessMock = mock((_garmentId?: string) => {});
    // Verify the mock is assignable to the expected prop type
    const html = render({ onSuccess: onSuccessMock, garmentId: "garment-xyz" });
    expect(html).toContain("Unlimited Try-Ons");
  });
});
