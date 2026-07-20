import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import type { AppConfig } from "./config";

const appleTokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  id_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string(),
});

export async function appleClientSecret(config: AppConfig, clientId = config.APPLE_CLIENT_ID): Promise<string> {
  const privateKey = config.APPLE_PRIVATE_KEY?.replaceAll("\\n", "\n");
  if (!clientId || !config.APPLE_TEAM_ID || !config.APPLE_KEY_ID || !privateKey) {
    throw new Error("Incomplete Apple authentication configuration");
  }
  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.APPLE_KEY_ID })
    .setIssuer(config.APPLE_TEAM_ID)
    .setSubject(clientId)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

export async function exchangeAppleAuthorizationCode(
  config: AppConfig,
  authorizationCode: string,
  fetcher: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken: string; idToken: string }> {
  const clientId = config.APPLE_APP_BUNDLE_IDENTIFIER;
  const response = await fetcher("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: await appleClientSecret(config, clientId),
      code: authorizationCode,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("APPLE_TOKEN_EXCHANGE_FAILED");
  const tokens = appleTokenResponse.parse(await response.json());
  if (!tokens.refresh_token) throw new Error("APPLE_REFRESH_TOKEN_MISSING");
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
  };
}

export async function revokeAppleToken(
  config: AppConfig,
  token: string,
  tokenType: "refresh_token" | "access_token",
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const clientId = config.APPLE_APP_BUNDLE_IDENTIFIER;
  const response = await fetcher("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: await appleClientSecret(config, clientId),
      token,
      token_type_hint: tokenType,
    }),
  });
  if (!response.ok) throw new Error("APPLE_TOKEN_REVOCATION_FAILED");
}
