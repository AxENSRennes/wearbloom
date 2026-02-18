import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "privacy_consent_accepted";

export const hasAcceptedConsent = async (): Promise<boolean> => {
  const value =
    Platform.OS === "web"
      ? await AsyncStorage.getItem(CONSENT_KEY)
      : await SecureStore.getItemAsync(CONSENT_KEY).catch(() =>
          AsyncStorage.getItem(CONSENT_KEY),
        );
  return value === "true";
};

export const hasAcceptedConsentSync = (): boolean | null => {
  if (Platform.OS === "web") {
    try {
      const localStorage = Reflect.get(globalThis, "localStorage") as
        | Storage
        | undefined;
      if (!localStorage) return null;
      return localStorage.getItem(CONSENT_KEY) === "true";
    } catch {
      return null;
    }
  }

  try {
    return SecureStore.getItem(CONSENT_KEY) === "true";
  } catch {
    return null;
  }
};

export const setConsentAccepted = async (): Promise<void> =>
  Platform.OS === "web"
    ? AsyncStorage.setItem(CONSENT_KEY, "true")
    : SecureStore.setItemAsync(CONSENT_KEY, "true").catch(() =>
        AsyncStorage.setItem(CONSENT_KEY, "true"),
      );
