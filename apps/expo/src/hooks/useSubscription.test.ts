import React from "react";
import { beforeEach, describe, expect, mock, test } from "bun:test";
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

mock.module("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    constructor() {}
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useMutation: () => ({
    mutate: mock(() => {}),
    mutateAsync: mock(() => Promise.resolve()),
    isPending: false,
  }),
  useQuery: () => queryState,
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
      state: "active",
      isSubscriber: true,
      rendersAllowed: true,
      isUnlimited: true,
      expiresAt: expiresDate,
      productId: "com.wearbloom.weekly",
      hadSubscription: true,
    };
    const result = runHook();

    expect(result.state).toBe("active");
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
