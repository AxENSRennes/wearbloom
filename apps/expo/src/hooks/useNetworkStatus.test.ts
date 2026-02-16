import { describe, expect, mock, spyOn, test, afterEach } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as NetInfo from "@react-native-community/netinfo";

import { useNetworkStatus } from "./useNetworkStatus";

function TestComponent({ onResult }: { onResult: (result: ReturnType<typeof useNetworkStatus>) => void }) {
  const result = useNetworkStatus();
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
        onResult: (r) => { captured = r; },
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
        onResult: (r) => { captured = r; },
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
        onResult: (r) => { captured = r; },
      }),
    );
    expect(captured?.isConnected).toBe(true);
  });
});
