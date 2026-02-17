import React from "react";
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// ---------------------------------------------------------------------------
// Mutable mock state — useQuery return value, mutated per test
// ---------------------------------------------------------------------------
const queryState = {
  data: null as Record<string, unknown> | null,
  isLoading: false,
  isError: false,
  error: null,
  isPending: false,
  isFetching: false,
  refetch: mock(() => Promise.resolve()),
};

const {
  QueryClient: _RQClient,
  QueryClientProvider: _RQProvider,
  useMutation: _useMutation,
  useQueryClient: _useQueryClient,
} = await import("@tanstack/react-query");
void mock.module("@tanstack/react-query", () => ({
  QueryClient: _RQClient,
  QueryClientProvider: _RQProvider,
  useMutation: _useMutation,
  useQueryClient: _useQueryClient,
  useQuery: () => queryState,
}));

// Mock tRPC proxy
function createTrpcProxy(): unknown {
  const handler: ProxyHandler<CallableFunction> = {
    get: (_target, prop) => {
      if (prop === "queryOptions") return () => ({});
      if (prop === "mutationOptions")
        return (opts?: Record<string, unknown>) => ({ ...opts });
      if (prop === "queryKey") {
        return () => ["mock-query-key"];
      }
      return createTrpcProxy();
    },
    apply: () => ({}),
  };
  return new Proxy(() => {}, handler);
}

const { queryClient: _queryClient } = await import("~/utils/api");
void mock.module("~/utils/api", () => ({
  trpc: createTrpcProxy(),
  queryClient: { ..._queryClient, invalidateQueries: mock(() => Promise.resolve()) },
}));

// ---------------------------------------------------------------------------
// Import the hook under test AFTER all mocks are in place
// ---------------------------------------------------------------------------
const { useSubscription } = await import("./useSubscription");

// ---------------------------------------------------------------------------
// Minimal hook runner
// ---------------------------------------------------------------------------
function runHook(): ReturnType<typeof useSubscription> {
  const resultRef = {
    current: undefined as ReturnType<typeof useSubscription> | undefined,
  };
  function TestComponent() {
    // eslint-disable-next-line react-hooks/immutability -- test-only hook runner, not a real component
    resultRef.current = useSubscription();
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
afterAll(() => {
  queryState.data = null;
  queryState.isLoading = false;
  queryState.isError = false;
  queryState.isPending = false;
  queryState.isFetching = false;
});

describe("useSubscription", () => {
  beforeEach(() => {
    queryState.data = null;
    queryState.isLoading = false;
    queryState.isError = false;
    queryState.error = null;
    queryState.isPending = false;
    queryState.refetch.mockClear();
  });

  test("returns default state when query data is null", () => {
    queryState.data = null;
    const result = runHook();

    expect(result.state).toBe("no_subscription");
    expect(result.isSubscriber).toBe(false);
    expect(result.rendersAllowed).toBe(false);
    expect(result.isUnlimited).toBe(false);
    expect(result.expiresAt).toBeNull();
    expect(result.productId).toBeNull();
    expect(result.hadSubscription).toBe(false);
    expect(result.isLoading).toBe(false);
  });

  test("returns isLoading true when query is loading", () => {
    queryState.isLoading = true;
    const result = runHook();

    expect(result.isLoading).toBe(true);
  });

  test("maps active subscription data correctly", () => {
    const expiresDate = new Date("2026-03-01T00:00:00Z");
    queryState.data = {
      state: "subscribed",
      isSubscriber: true,
      rendersAllowed: true,
      isUnlimited: true,
      expiresAt: expiresDate,
      productId: "com.wearbloom.weekly",
      hadSubscription: true,
    };
    const result = runHook();

    expect(result.state).toBe("subscribed");
    expect(result.isSubscriber).toBe(true);
    expect(result.rendersAllowed).toBe(true);
    expect(result.isUnlimited).toBe(true);
    expect(result.expiresAt).toEqual(expiresDate);
    expect(result.productId).toBe("com.wearbloom.weekly");
    expect(result.hadSubscription).toBe(true);
  });

  test("maps expired subscription data correctly", () => {
    queryState.data = {
      state: "expired",
      isSubscriber: false,
      rendersAllowed: false,
      isUnlimited: false,
      expiresAt: new Date("2026-01-01T00:00:00Z"),
      productId: "com.wearbloom.weekly",
      hadSubscription: true,
    };
    const result = runHook();

    expect(result.state).toBe("expired");
    expect(result.isSubscriber).toBe(false);
    expect(result.rendersAllowed).toBe(false);
    expect(result.hadSubscription).toBe(true);
  });

  test("maps grace_period state correctly", () => {
    queryState.data = {
      state: "grace_period",
      isSubscriber: true,
      rendersAllowed: true,
      isUnlimited: false,
      expiresAt: null,
      productId: "com.wearbloom.weekly",
      hadSubscription: true,
    };
    const result = runHook();

    expect(result.state).toBe("grace_period");
    expect(result.isSubscriber).toBe(true);
    expect(result.rendersAllowed).toBe(true);
  });

  test("exposes refetch function from the query", () => {
    const result = runHook();

    expect(typeof result.refetch).toBe("function");
  });
});
