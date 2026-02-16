import { describe, expect, mock, spyOn, test, afterEach } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactQuery from "@tanstack/react-query";

import { showToast } from "@acme/ui";

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

  test("renders without error", () => {
    spyOn(networkStatusModule, "useNetworkStatus").mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
    });
    spyOn(reactQuery, "useQueryClient").mockReturnValue({
      invalidateQueries: mock(() => Promise.resolve()),
    } as unknown as ReturnType<typeof reactQuery.useQueryClient>);

    const html = renderToStaticMarkup(React.createElement(TestComponent));
    expect(html).toContain("test");
  });
});
