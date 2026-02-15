import * as SecureStore from "expo-secure-store";

const CONSENT_KEY = "privacy_consent_accepted";

export const hasAcceptedConsent = (): boolean =>
  SecureStore.getItem(CONSENT_KEY) === "true";

export const setConsentAccepted = (): void =>
  SecureStore.setItem(CONSENT_KEY, "true");
