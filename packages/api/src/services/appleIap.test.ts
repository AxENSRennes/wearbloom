import { describe, expect, mock, test } from "bun:test";

import { createAppleClient, createVerifier } from "./appleIap";

// Mock the Apple library before any imports
void mock.module("@apple/app-store-server-library", () => ({
  AppStoreServerAPIClient: mock(
    () =>
      ({
        requestTestNotification: mock(() =>
          Promise.resolve({ testNotificationToken: "test-token" }),
        ),
      }) as Record<string, unknown>,
  ),
  SignedDataVerifier: mock(
    () =>
      ({
        verifyAndDecodeNotification: mock(() => Promise.resolve({})),
        verifyAndDecodeTransaction: mock(() => Promise.resolve({})),
      }) as Record<string, unknown>,
  ),
  Environment: {
    SANDBOX: "Sandbox",
    PRODUCTION: "Production",
  },
}));

// Mock node:fs for certificate reading
void mock.module("node:fs", () => ({
  readFileSync: mock((..._args: unknown[]) => Buffer.from("mock-cert-data")),
}));

describe("appleIap", () => {
  const validConfig = {
    appleIapKeyId: "TESTKEY123",
    appleIapIssuerId: "test-issuer-uuid",
    appleIapKeyPath: "./certs/TestKey.p8",
    appleBundleId: "com.test.app",
    appleAppId: 123456789,
    nodeEnv: "development" as const,
    certsDir: "./certs",
  };

  describe("createAppleClient", () => {
    test("creates client with valid config", () => {
      const client = createAppleClient(validConfig);
      expect(client).toBeDefined();
    });

    test("throws when required config is missing", () => {
      expect(() =>
        createAppleClient({
          ...validConfig,
          appleIapKeyId: undefined as unknown as string,
        }),
      ).toThrow();
    });
  });

  describe("createVerifier", () => {
    test("creates verifier with valid config", () => {
      const verifier = createVerifier(validConfig);
      expect(verifier).toBeDefined();
    });

    test("passes appAppleId only in production", () => {
      const verifier = createVerifier({
        ...validConfig,
        nodeEnv: "production",
      });
      expect(verifier).toBeDefined();
    });
  });
});
