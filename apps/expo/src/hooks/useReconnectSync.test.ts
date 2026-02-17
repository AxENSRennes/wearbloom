import { describe, expect, mock, spyOn, test, afterEach } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactQuery from "@tanstack/react-query";

import * as networkStatusModule from "./useNetworkStatus";
import { useReconnectSync } from "./useReconnectSync";

function TestComponent() {
  useReconnectSync();
  return React.createElement("div", null, "test");
}

describe("useReconnectSync", () => {
  afterEach(() => {
    mock.restore();
  });

  test("calls useNetworkStatus with onReconnect callback", () => {
    const networkSpy = spyOn(networkStatusModule, "useNetworkStatus").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });
    spyOn(reactQuery, "useQueryClient").mockReturnValue({
      invalidateQueries: mock(() => Promise.resolve()),
    } as unknown as ReturnType<typeof reactQuery.useQueryClient>);
    spyOn(reactQuery, "useMutation").mockReturnValue({
      mutateAsync: mock(() => Promise.resolve()),
      mutate: mock(() => {}),
      isPending: false,
      isError: false,
      error: null,
      data: null,
    } as unknown as ReturnType<typeof reactQuery.useMutation>);

    renderToStaticMarkup(React.createElement(TestComponent));

    expect(networkSpy).toHaveBeenCalledTimes(1);
    const callArgs = networkSpy.mock.calls[0] as unknown[];
    const options = callArgs[0] as { onReconnect?: () => void };
    expect(options).toBeDefined();
    expect(typeof options.onReconnect).toBe("function");
  });

  test("calls useMutation with garment upload options", () => {
    spyOn(networkStatusModule, "useNetworkStatus").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });
    spyOn(reactQuery, "useQueryClient").mockReturnValue({
      invalidateQueries: mock(() => Promise.resolve()),
    } as unknown as ReturnType<typeof reactQuery.useQueryClient>);
    const mutationSpy = spyOn(reactQuery, "useMutation").mockReturnValue({
      mutateAsync: mock(() => Promise.resolve()),
      mutate: mock(() => {}),
      isPending: false,
      isError: false,
      error: null,
      data: null,
    } as unknown as ReturnType<typeof reactQuery.useMutation>);

    renderToStaticMarkup(React.createElement(TestComponent));

    expect(mutationSpy).toHaveBeenCalledTimes(1);
  });

  test("renders without error", () => {
    spyOn(networkStatusModule, "useNetworkStatus").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });
    spyOn(reactQuery, "useQueryClient").mockReturnValue({
      invalidateQueries: mock(() => Promise.resolve()),
    } as unknown as ReturnType<typeof reactQuery.useQueryClient>);
    spyOn(reactQuery, "useMutation").mockReturnValue({
      mutateAsync: mock(() => Promise.resolve()),
      mutate: mock(() => {}),
      isPending: false,
      isError: false,
      error: null,
      data: null,
    } as unknown as ReturnType<typeof reactQuery.useMutation>);

    const html = renderToStaticMarkup(React.createElement(TestComponent));
    expect(html).toContain("test");
  });
});
