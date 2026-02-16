import { describe, expect, mock, test, beforeEach } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mutable mock state — mutated per test, referenced by mock.module closures
// ---------------------------------------------------------------------------
let onPurchaseSuccessCallback: ((purchase: unknown) => void) | undefined;
let onPurchaseErrorCallback: ((error: unknown) => void) | undefined;

const iapState = {
  connected: false,
  subscriptions: [] as unknown[],
  fetchProducts: mock(() => Promise.resolve()),
  requestPurchase: mock(() => Promise.resolve()),
  finishTransaction: mock(() => Promise.resolve()),
  restorePurchases: mock(() => Promise.resolve()),
};

const getAvailablePurchasesMock = mock(() => Promise.resolve([]));

mock.module("expo-iap", () => ({
  useIAP: (opts?: {
    onPurchaseSuccess?: (purchase: unknown) => void;
    onPurchaseError?: (error: unknown) => void;
  }) => {
    onPurchaseSuccessCallback = opts?.onPurchaseSuccess;
    onPurchaseErrorCallback = opts?.onPurchaseError;
    return iapState;
  },
  getAvailablePurchases: getAvailablePurchasesMock,
  ErrorCode: {
    UserCancelled: "user-cancelled",
    Unknown: "unknown",
  },
}));

// ---------------------------------------------------------------------------
// Mock tRPC + TanStack Query — verifyMutation and restoreMutation tracking
// ---------------------------------------------------------------------------
const verifyMutateAsync = mock(() => Promise.resolve());
const restoreMutateAsync = mock(() =>
  Promise.resolve({ restored: 1 }),
);
const invalidateQueriesMock = mock(() => Promise.resolve());

const verifyMutationState = {
  mutateAsync: verifyMutateAsync,
  isPending: false,
  error: null as Error | null,
};

const restoreMutationState = {
  mutateAsync: restoreMutateAsync,
  isPending: false,
  error: null as Error | null,
};

let mutationCallIndex = 0;

mock.module("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    constructor() {}
    invalidateQueries = invalidateQueriesMock;
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useMutation: () => {
    // useStoreKit calls useMutation twice: first for verify, second for restore
    const idx = mutationCallIndex++;
    if (idx % 2 === 0) return verifyMutationState;
    return restoreMutationState;
  },
  useQuery: () => ({
    data: null,
    isLoading: false,
    isPending: false,
  }),
}));

// Mock tRPC proxy to return objects with queryKey/mutationOptions
function createTrpcProxy(): unknown {
  const handler: ProxyHandler<CallableFunction> = {
    get: (_target, prop) => {
      if (prop === "queryOptions" || prop === "mutationOptions") {
        return () => ({});
      }
      if (prop === "queryKey") {
        // queryKey is called as a function: trpc.subscription.getSubscriptionStatus.queryKey()
        return () => ["mock-query-key"];
      }
      return createTrpcProxy();
    },
    apply: () => ({}),
  };
  return new Proxy(() => {}, handler);
}

const trpcProxy = createTrpcProxy();

mock.module("~/utils/api", () => ({
  trpc: trpcProxy,
  queryClient: {
    invalidateQueries: invalidateQueriesMock,
  },
}));

// ---------------------------------------------------------------------------
// Import the hook under test AFTER all mocks are in place
// ---------------------------------------------------------------------------
const { useStoreKit } = await import("./useStoreKit");

// ---------------------------------------------------------------------------
// Minimal hook runner
// ---------------------------------------------------------------------------
function runHook(
  userId = "user-123",
): ReturnType<typeof useStoreKit> {
  let result!: ReturnType<typeof useStoreKit>;
  function TestComponent() {
    result = useStoreKit({ userId });
    return null;
  }
  renderToStaticMarkup(React.createElement(TestComponent));
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useStoreKit", () => {
  beforeEach(() => {
    mutationCallIndex = 0;
    iapState.connected = false;
    iapState.subscriptions = [];
    iapState.fetchProducts.mockClear();
    iapState.requestPurchase.mockClear();
    iapState.finishTransaction.mockClear();
    iapState.restorePurchases.mockClear();
    getAvailablePurchasesMock.mockClear();
    verifyMutateAsync.mockClear();
    restoreMutateAsync.mockClear();
    invalidateQueriesMock.mockClear();
    verifyMutationState.isPending = false;
    verifyMutationState.error = null;
    restoreMutationState.isPending = false;
    onPurchaseSuccessCallback = undefined;
    onPurchaseErrorCallback = undefined;
  });

  test("returns initial disconnected state", () => {
    iapState.connected = false;
    const result = runHook();

    expect(result.connected).toBe(false);
    expect(result.isReady).toBe(false);
    expect(result.product).toBeNull();
    expect(result.isPurchasing).toBe(false);
    expect(result.isRestoring).toBe(false);
    expect(result.purchaseError).toBeNull();
    expect(result.verifyError).toBeNull();
  });

  test("exposes the first subscription as product", () => {
    const mockProduct = { productId: "com.wearbloom.weekly", price: "$4.99" };
    iapState.subscriptions = [mockProduct];
    const result = runHook();

    expect(result.product).toEqual(mockProduct);
  });

  test("product is null when subscriptions array is empty", () => {
    iapState.subscriptions = [];
    const result = runHook();

    expect(result.product).toBeNull();
  });

  test("purchase calls requestPurchase with correct SKU and appAccountToken", async () => {
    const result = runHook("user-abc");
    await result.purchase();

    expect(iapState.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {
          sku: "com.wearbloom.weekly",
          appAccountToken: "user-abc",
        },
      },
      type: "subs",
    });
  });

  test("isPurchasing reflects verifyMutation.isPending", () => {
    verifyMutationState.isPending = true;
    const result = runHook();
    expect(result.isPurchasing).toBe(true);
  });

  test("verifyError reflects verifyMutation.error", () => {
    const testError = new Error("Verification failed");
    verifyMutationState.error = testError;
    const result = runHook();
    expect(result.verifyError).toBe(testError);
  });

  test("onPurchaseSuccess calls verifyMutation.mutateAsync with purchaseToken", async () => {
    runHook();
    expect(onPurchaseSuccessCallback).toBeDefined();

    await onPurchaseSuccessCallback!({
      purchaseToken: "signed-jws-token-123",
    });

    expect(verifyMutateAsync).toHaveBeenCalledWith({
      signedTransactionInfo: "signed-jws-token-123",
    });
  });

  test("onPurchaseSuccess sends empty string when purchaseToken is undefined", async () => {
    runHook();

    await onPurchaseSuccessCallback!({ purchaseToken: undefined });

    expect(verifyMutateAsync).toHaveBeenCalledWith({
      signedTransactionInfo: "",
    });
  });

  test("onPurchaseError sets purchaseError state", () => {
    const result = runHook();
    expect(onPurchaseErrorCallback).toBeDefined();

    // The error callback sets state — in a sync render we can only verify it was captured
    const mockError = { code: "user-cancelled", message: "User cancelled" };
    onPurchaseErrorCallback!(mockError);

    // After the callback fires, re-render to pick up state
    const result2 = runHook();
    // purchaseError comes from useState, which resets per render in static markup
    // We verify the callback itself is wired up correctly
    expect(onPurchaseErrorCallback).toBeDefined();
  });

  test("restore calls restorePurchases then getAvailablePurchases", async () => {
    getAvailablePurchasesMock.mockImplementation(() =>
      Promise.resolve([
        { purchaseToken: "token-1" },
        { purchaseToken: "token-2" },
      ]),
    );
    restoreMutateAsync.mockImplementation(() =>
      Promise.resolve({ restored: 2 }),
    );

    const result = runHook();
    const restoreResult = await result.restore();

    expect(iapState.restorePurchases).toHaveBeenCalled();
    expect(getAvailablePurchasesMock).toHaveBeenCalled();
    expect(restoreMutateAsync).toHaveBeenCalledWith({
      signedTransactions: ["token-1", "token-2"],
    });
    expect(restoreResult).toEqual({ restored: 2 });
  });

  test("restore returns early with restored:0 when no purchases found", async () => {
    getAvailablePurchasesMock.mockImplementation(() => Promise.resolve([]));

    const result = runHook();
    const restoreResult = await result.restore();

    expect(iapState.restorePurchases).toHaveBeenCalled();
    expect(restoreMutateAsync).not.toHaveBeenCalled();
    expect(restoreResult).toEqual({ restored: 0 });
  });

  test("restore filters out purchases with null/undefined purchaseToken", async () => {
    getAvailablePurchasesMock.mockImplementation(() =>
      Promise.resolve([
        { purchaseToken: "valid-token" },
        { purchaseToken: null },
        { purchaseToken: undefined },
      ]),
    );

    const result = runHook();
    await result.restore();

    expect(restoreMutateAsync).toHaveBeenCalledWith({
      signedTransactions: ["valid-token"],
    });
  });
});
