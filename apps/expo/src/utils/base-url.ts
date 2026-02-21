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

  // Always use configured API URL (or production default).
  // Local server override removed — solo dev workflow uses VPS directly.
  return configuredApiUrl ?? DEFAULT_PRODUCTION_API_URL;
};
