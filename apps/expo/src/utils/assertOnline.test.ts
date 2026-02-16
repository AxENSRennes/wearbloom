import { describe, expect, mock, test, afterEach, spyOn } from "bun:test";
import NetInfo from "@react-native-community/netinfo";

import { showToast } from "@acme/ui";

import { assertOnline } from "./assertOnline";

describe("assertOnline", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns true when online", async () => {
    spyOn(NetInfo, "fetch").mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const result = await assertOnline();
    expect(result).toBe(true);
  });

  test("returns false and shows toast when offline", async () => {
    spyOn(NetInfo, "fetch").mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const result = await assertOnline();
    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith({
      message: "Needs internet for try-on",
      variant: "error",
    });
  });

  test("returns false when connected but internet not reachable (captive portal)", async () => {
    spyOn(NetInfo, "fetch").mockResolvedValue({
      isConnected: true,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const result = await assertOnline();
    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith({
      message: "Needs internet for try-on",
      variant: "error",
    });
  });

  test("returns true when isInternetReachable is null (optimistic)", async () => {
    spyOn(NetInfo, "fetch").mockResolvedValue({
      isConnected: true,
      isInternetReachable: null,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const result = await assertOnline();
    expect(result).toBe(true);
  });

  test("shows custom message when provided", async () => {
    spyOn(NetInfo, "fetch").mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    await assertOnline("Custom offline message");
    expect(showToast).toHaveBeenCalledWith({
      message: "Custom offline message",
      variant: "error",
    });
  });
});
