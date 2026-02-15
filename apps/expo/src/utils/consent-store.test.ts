import { beforeEach, describe, expect, test } from "bun:test";
import * as SecureStore from "expo-secure-store";

import { hasAcceptedConsent, setConsentAccepted } from "./consent-store";

const store = (SecureStore as unknown as { __store: Map<string, string> })
  .__store;

describe("consent-store", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("hasAcceptedConsent", () => {
    test("returns false when no consent key exists", () => {
      expect(hasAcceptedConsent()).toBe(false);
    });

    test('returns true when consent key is "true"', () => {
      SecureStore.setItem("privacy_consent_accepted", "true");
      expect(hasAcceptedConsent()).toBe(true);
    });

    test("returns false when consent key has unexpected value", () => {
      SecureStore.setItem("privacy_consent_accepted", "false");
      expect(hasAcceptedConsent()).toBe(false);
    });
  });

  describe("setConsentAccepted", () => {
    test("writes the consent key so hasAcceptedConsent returns true", () => {
      expect(hasAcceptedConsent()).toBe(false);
      setConsentAccepted();
      expect(hasAcceptedConsent()).toBe(true);
    });

    test('stores "true" under the correct key', () => {
      setConsentAccepted();
      expect(SecureStore.getItem("privacy_consent_accepted")).toBe("true");
    });
  });
});
