import { describe, expect, test } from "bun:test";
import { exportPKCS8, generateKeyPair } from "jose";
import { exchangeAppleAuthorizationCode, revokeAppleToken } from "../src/apple-auth";
import { loadConfig } from "../src/config";

async function appleConfig() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  return loadConfig({
    DATABASE_URL: "postgres://wearbloom:wearbloom@localhost:5432/wearbloom",
    BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
    APPLE_CLIENT_ID: "app.wearbloom.web",
    APPLE_APP_BUNDLE_IDENTIFIER: "com.axel.wearbloom",
    APPLE_TEAM_ID: "TEAM123456",
    APPLE_KEY_ID: "KEY1234567",
    APPLE_PRIVATE_KEY: await exportPKCS8(privateKey),
  });
}

describe("Sign in with Apple token lifecycle", () => {
  test("exchanges the native authorization code for a revocable refresh token", async () => {
    const config = await appleConfig();
    let form: URLSearchParams | undefined;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://appleid.apple.com/auth/token");
      form = new URLSearchParams(String(init?.body));
      return Response.json({
        access_token: "access-token",
        expires_in: 3600,
        id_token: "header.payload.signature",
        refresh_token: "refresh-token",
        token_type: "Bearer",
      });
    }) as typeof fetch;

    const result = await exchangeAppleAuthorizationCode(config, "native-code", fetcher);

    expect(result.refreshToken).toBe("refresh-token");
    expect(form?.get("client_id")).toBe("com.axel.wearbloom");
    expect(form?.get("code")).toBe("native-code");
    expect(form?.get("grant_type")).toBe("authorization_code");
    expect(form?.get("client_secret")?.split(".")).toHaveLength(3);
  });

  test("revokes the refresh token with Apple's endpoint", async () => {
    const config = await appleConfig();
    let form: URLSearchParams | undefined;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://appleid.apple.com/auth/revoke");
      form = new URLSearchParams(String(init?.body));
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await revokeAppleToken(config, "refresh-token", "refresh_token", fetcher);

    expect(form?.get("token")).toBe("refresh-token");
    expect(form?.get("token_type_hint")).toBe("refresh_token");
    expect(form?.get("client_id")).toBe("com.axel.wearbloom");
  });
});
