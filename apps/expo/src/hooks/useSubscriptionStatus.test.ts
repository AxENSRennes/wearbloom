import { describe, expect, mock, test } from "bun:test";

import { useSubscriptionStatus } from "./useSubscriptionStatus";

function mockUseQuery(data: Record<string, unknown> | null, isLoading = false) {
  void mock.module("@tanstack/react-query", () => ({
    QueryClient: class {},
    QueryClientProvider: ({ children }: { children: unknown }) => children,
    useMutation: () => ({
      mutate: mock(() => {}),
      mutateAsync: mock(() => Promise.resolve()),
      isPending: false,
    }),
    useQuery: () => ({ data, isLoading, isError: false, error: null }),
  }));
}

describe("useSubscriptionStatus", () => {
  test("returns defaults when loading", () => {
    mockUseQuery(null, true);
    const result = useSubscriptionStatus();

    expect(result.isSubscriber).toBe(false);
    expect(result.creditsRemaining).toBe(0);
    expect(result.state).toBe("free_no_credits");
    expect(result.isLoading).toBe(true);
    expect(result.canRender).toBe(false);
  });

  test("returns subscriber status when data available", () => {
    mockUseQuery({
      isSubscriber: true,
      creditsRemaining: 0,
      state: "subscribed",
      canRender: true,
    });
    const result = useSubscriptionStatus();

    expect(result.isSubscriber).toBe(true);
    expect(result.canRender).toBe(true);
    expect(result.isLoading).toBe(false);
  });

  test("returns free user with credits", () => {
    mockUseQuery({
      isSubscriber: false,
      creditsRemaining: 2,
      state: "free_with_credits",
      canRender: true,
    });
    const result = useSubscriptionStatus();

    expect(result.isSubscriber).toBe(false);
    expect(result.creditsRemaining).toBe(2);
    expect(result.state).toBe("free_with_credits");
    expect(result.canRender).toBe(true);
  });

  test("returns free user with no credits — canRender false", () => {
    mockUseQuery({
      isSubscriber: false,
      creditsRemaining: 0,
      state: "free_no_credits",
      canRender: false,
    });
    const result = useSubscriptionStatus();

    expect(result.canRender).toBe(false);
    expect(result.state).toBe("free_no_credits");
  });
});
