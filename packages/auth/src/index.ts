import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy } from "better-auth/plugins";

import { db } from "@acme/db/client";

interface AuthLogger {
  error: (obj: unknown, msg: string) => void;
}

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  appleBundleId: string;
  isDev: boolean;
  logger: AuthLogger;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      oAuthProxy({
        productionURL: options.productionUrl,
      }),
      expo(),
      ...(options.extraPlugins ?? []),
    ],
    socialProviders: {
      apple: {
        clientId: options.appleBundleId,
        clientSecret: "",
        appBundleIdentifier: options.appleBundleId,
      },
    },
    trustedOrigins: [
      "expo://",
      "https://appleid.apple.com",
      ...(options.isDev ? ["exp://"] : []),
    ],
    onAPIError: {
      onError(error, ctx) {
        options.logger.error({ error, ctx }, "BETTER AUTH API ERROR");
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
