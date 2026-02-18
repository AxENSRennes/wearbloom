import { Platform } from "react-native";
import Constants from "expo-constants";

const DEFAULT_PRODUCTION_API_URL = "https://api.wearbloom.app";

function normalizeBaseUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function getConfiguredApiUrl() {
  const extra = Constants.expoConfig?.extra as
    | Record<string, unknown>
    | undefined;
  const apiUrl = extra?.apiUrl;
  if (typeof apiUrl === "string" && apiUrl.length > 0) {
    return normalizeBaseUrl(apiUrl);
  }
  return null;
}

export const getBaseUrl = () => {
  const configuredApiUrl = getConfiguredApiUrl();
  const debuggerHost = Constants.expoConfig?.hostUri;
  const hostFromExpo = debuggerHost?.split(":")[0];

  // Dev client / Expo Go: keep local server default when available.
  if (__DEV__) {
    if (Platform.OS === "web") {
      const location = Reflect.get(globalThis, "location") as
        | Pick<Location, "hostname" | "protocol">
        | undefined;
      const hostname = location?.hostname;
      if (hostname) {
        return `${location.protocol}//${hostname}:3000`;
      }
    }
    if (hostFromExpo) {
      return `http://${hostFromExpo}:3000`;
    }
  }

  // Standalone/TestFlight or explicit config.
  return configuredApiUrl ?? DEFAULT_PRODUCTION_API_URL;
};
