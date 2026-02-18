import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { anonymousClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getBaseUrl } from "./base-url";

const APP_SCHEME = "wearbloom";
const WEB_STORAGE_KEY_PREFIX = `${APP_SCHEME}.`;

const webStorage = {
  getItem: (key: string): string | null => {
    try {
      const localStorage = Reflect.get(globalThis, "localStorage") as
        | Storage
        | undefined;
      if (!localStorage) return null;
      return localStorage.getItem(`${WEB_STORAGE_KEY_PREFIX}${key}`);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const localStorage = Reflect.get(globalThis, "localStorage") as
        | Storage
        | undefined;
      if (!localStorage) return;
      localStorage.setItem(`${WEB_STORAGE_KEY_PREFIX}${key}`, value);
    } catch {
      // Ignore storage write failures in restricted browser contexts.
    }
  },
};

export const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      storage: Platform.OS === "web" ? webStorage : SecureStore,
    }),
    anonymousClient(),
  ],
});
