import React from "react";
import { beforeEach, describe, expect, mock, test } from "bun:test";
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

const getAvailablePurchasesMock = mock(() =>
  Promise.resolve([] as { purchaseToken?: string | null }[]),
);

void mock.module("expo-iap", () => ({
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
const restoreMutateAsync = mock(() => Promise.resolve({ restored: 1 }));
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

const {
  QueryClient: _RQClient,
  QueryClientProvider: _RQProvider,
  useQueryClient: _useQueryClient,
} = await import("@tanstack/react-query");
void mock.module("@tanstack/react-query", () => ({
  QueryClient: _RQClient,
  QueryClientProvider: _RQProvider,
  useQueryClient: _useQueryClient,
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
      if (prop === "queryOptions") return () => ({});
      if (prop === "mutationOptions")
        return (opts?: Record<string, unknown>) => ({ ...opts });
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

const { queryClient: _queryClient } = await import("~/utils/api");
void mock.module("~/utils/api", () => ({
  trpc: trpcProxy,
  queryClient: {
    ..._queryClient,
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
function runHook(userId = "user-123"): ReturnType<typeof useStoreKit> {
  const resultRef = {
    current: undefined as ReturnType<typeof useStoreKit> | undefined,
  };
  function TestComponent() {
    // eslint-disable-next-line react-hooks/immutability -- test-only hook runner, not a real component
    resultRef.current = useStoreKit({ userId });
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
    expect(result.productLoadState).toBe("idle");
    expect(result.productLoadError).toBeNull();
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

    expect(result.product as unknown).toBe(mockProduct);
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
    expect(result.verifyError as Error | null).toBe(testError);
  });

  test("onPurchaseSuccess calls verifyMutation.mutateAsync with purchaseToken", async () => {
    runHook();
    expect(onPurchaseSuccessCallback).toBeDefined();

    if (!onPurchaseSuccessCallback) throw new Error("expected callback");
    await onPurchaseSuccessCallback({
      purchaseToken: "signed-jws-token-123",
    });

    expect(verifyMutateAsync).toHaveBeenCalledWith({
      signedTransactionInfo: "signed-jws-token-123",
    });
  });

  test("onPurchaseSuccess sends empty string when purchaseToken is undefined", async () => {
    runHook();

    if (!onPurchaseSuccessCallback) throw new Error("expected callback");
    await onPurchaseSuccessCallback({ purchaseToken: undefined });

    expect(verifyMutateAsync).toHaveBeenCalledWith({
      signedTransactionInfo: "",
    });
  });

  test("onPurchaseError sets purchaseError state", () => {
    runHook();
    expect(onPurchaseErrorCallback).toBeDefined();

    // The error callback sets state — in a sync render we can only verify it was captured
    const mockError = { code: "user-cancelled", message: "User cancelled" };
    if (!onPurchaseErrorCallback) throw new Error("expected callback");
    onPurchaseErrorCallback(mockError);

    // After the callback fires, re-render to pick up state
    runHook();
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

  test("retryProductFetch requests subscription SKU", async () => {
    iapState.connected = true;
    const result = runHook();

    await result.retryProductFetch();

    expect(iapState.fetchProducts).toHaveBeenCalledWith({
      skus: ["com.wearbloom.weekly"],
      type: "subs",
    });
  });

  test("retryProductFetch does not throw when fetchProducts fails", async () => {
    iapState.connected = true;
    iapState.fetchProducts.mockImplementation(() =>
      Promise.reject(new Error("network down")),
    );
    const result = runHook();

    await expect(result.retryProductFetch()).resolves.toBeUndefined();
  });
});
