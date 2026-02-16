import NetInfo from "@react-native-community/netinfo";

import { showToast } from "@acme/ui";

/**
 * Checks if the device is online. If offline, shows an error toast and returns false.
 * Designed to be consumed by Story 3.1 (Garment Detail Bottom Sheet) for the "Try On" action.
 */
export async function assertOnline(
  message = "Needs internet for try-on",
): Promise<boolean> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    showToast({ message, variant: "error" });
    return false;
  }
  return true;
}
