import React from "react";
import * as NetInfo from "@react-native-community/netinfo";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { useNetworkStatus } from "./useNetworkStatus";

interface TestComponentProps {
  onResult: (result: ReturnType<typeof useNetworkStatus>) => void;
  hookOptions?: Parameters<typeof useNetworkStatus>[0];
}

function TestComponent({ onResult, hookOptions }: TestComponentProps) {
  const result = useNetworkStatus(hookOptions);
  onResult(result);
  return React.createElement("div", null, JSON.stringify(result));
}

describe("useNetworkStatus", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns isConnected: true when NetInfo says connected", () => {
    spyOn(NetInfo, "useNetInfo").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    } as ReturnType<typeof NetInfo.useNetInfo>);

    let captured: ReturnType<typeof useNetworkStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(captured?.isConnected).toBe(true);
    expect(captured?.isInternetReachable).toBe(true);
  });

  test("returns isConnected: false when NetInfo says disconnected", () => {
    spyOn(NetInfo, "useNetInfo").mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      type: "none",
    } as ReturnType<typeof NetInfo.useNetInfo>);

    let captured: ReturnType<typeof useNetworkStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(captured?.isConnected).toBe(false);
  });

  test("defaults isConnected to true when NetInfo returns null", () => {
    spyOn(NetInfo, "useNetInfo").mockReturnValue({
      isConnected: null,
      isInternetReachable: null,
      type: "unknown",
    } as ReturnType<typeof NetInfo.useNetInfo>);

    let captured: ReturnType<typeof useNetworkStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
      }),
    );
    expect(captured?.isConnected).toBe(true);
  });

  // Note: SSR (renderToStaticMarkup) does not execute useEffect, so we cannot
  // test the offline->online reconnect transition that triggers onReconnect in
  // this environment. This test verifies the hook accepts the onReconnect option
  // and still returns correct network status values without errors.
  test("accepts onReconnect option and returns correct status", () => {
    spyOn(NetInfo, "useNetInfo").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      type: "wifi",
    } as ReturnType<typeof NetInfo.useNetInfo>);

    const onReconnect = mock(() => undefined);
    let captured: ReturnType<typeof useNetworkStatus> | undefined;
    renderToStaticMarkup(
      React.createElement(TestComponent, {
        onResult: (r) => {
          captured = r;
        },
        hookOptions: { onReconnect },
      }),
    );
    expect(captured?.isConnected).toBe(true);
    expect(captured?.isInternetReachable).toBe(true);
  });
});
