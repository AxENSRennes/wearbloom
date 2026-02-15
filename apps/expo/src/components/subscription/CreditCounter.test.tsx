import React from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { CreditCounter } from "./CreditCounter";

// We control useQuery behavior per test by re-mocking @tanstack/react-query
function renderWithSubscription(data: {
  isSubscriber: boolean;
  creditsRemaining: number;
  state: string;
  canRender: boolean;
} | null, isLoading = false) {
  mock.module("@tanstack/react-query", () => ({
    QueryClient: class {},
    QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useMutation: () => ({
      mutate: mock(() => {}),
      mutateAsync: mock(() => Promise.resolve()),
      isPending: false,
    }),
    useQuery: () => ({
      data,
      isLoading,
      isError: false,
      error: null,
    }),
  }));

  return renderToString(React.createElement(CreditCounter));
}

describe("CreditCounter", () => {
  test("renders null when loading", () => {
    const html = renderWithSubscription(null, true);
    expect(html).toBe("");
  });

  test("renders null when data is null", () => {
    const html = renderWithSubscription(null, false);
    expect(html).toBe("");
  });

  test("renders null for subscriber (hidden per AC #6)", () => {
    const html = renderWithSubscription({
      isSubscriber: true,
      creditsRemaining: 0,
      state: "subscribed",
      canRender: true,
    });
    expect(html).toBe("");
  });

  test("renders credit count for free user with credits", () => {
    const html = renderWithSubscription({
      isSubscriber: false,
      creditsRemaining: 2,
      state: "free_with_credits",
      canRender: true,
    });
    expect(html).toContain("2 free renders left");
  });

  test("renders singular form for 1 credit", () => {
    const html = renderWithSubscription({
      isSubscriber: false,
      creditsRemaining: 1,
      state: "free_with_credits",
      canRender: true,
    });
    expect(html).toContain("1 free render left");
  });

  test("renders 'Start free trial' for zero credits", () => {
    const html = renderWithSubscription({
      isSubscriber: false,
      creditsRemaining: 0,
      state: "free_no_credits",
      canRender: false,
    });
    expect(html).toContain("Start free trial");
  });
});
