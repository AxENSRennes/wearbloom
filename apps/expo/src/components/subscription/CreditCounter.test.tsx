import React from "react";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToString } from "react-dom/server";
import * as rq from "@tanstack/react-query";

import { CreditCounter } from "./CreditCounter";

afterEach(() => {
  mock.restore();
});

function renderWithSubscription(
  data: {
    isSubscriber: boolean;
    creditsRemaining: number;
    state: string;
    canRender: boolean;
  } | null,
  isLoading = false,
) {
  spyOn(rq, "useQuery").mockReturnValue({
    data,
    isLoading,
    isError: false,
    error: null,
  } as never);

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
