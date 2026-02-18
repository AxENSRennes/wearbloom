import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, test } from "bun:test";

import {
  hasAcceptedConsent,
  hasAcceptedConsentSync,
  setConsentAccepted,
} from "./consent-store";

const store = (SecureStore as unknown as { __store: Map<string, string> })
  .__store;

describe("consent-store", () => {
  beforeEach(() => {
    store.clear();
  });

  describe("hasAcceptedConsent", () => {
    test("returns false when no consent key exists", async () => {
      await expect(hasAcceptedConsent()).resolves.toBe(false);
    });

    test('returns true when consent key is "true"', async () => {
      await SecureStore.setItemAsync("privacy_consent_accepted", "true");
      await expect(hasAcceptedConsent()).resolves.toBe(true);
    });

    test("returns false when consent key has unexpected value", async () => {
      await SecureStore.setItemAsync("privacy_consent_accepted", "false");
      await expect(hasAcceptedConsent()).resolves.toBe(false);
    });
  });

  describe("hasAcceptedConsentSync", () => {
    test("returns false when no consent key exists", () => {
      expect(hasAcceptedConsentSync()).toBe(false);
    });

    test('returns true when consent key is "true"', () => {
      SecureStore.setItem("privacy_consent_accepted", "true");
      expect(hasAcceptedConsentSync()).toBe(true);
    });
  });

  describe("setConsentAccepted", () => {
    test("writes the consent key so hasAcceptedConsent returns true", async () => {
      await expect(hasAcceptedConsent()).resolves.toBe(false);
      await setConsentAccepted();
      await expect(hasAcceptedConsent()).resolves.toBe(true);
    });

    test('stores "true" under the correct key', async () => {
      await setConsentAccepted();
      await expect(
        SecureStore.getItemAsync("privacy_consent_accepted"),
      ).resolves.toBe("true");
    });
  });
});
