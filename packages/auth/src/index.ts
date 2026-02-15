import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, oAuthProxy } from "better-auth/plugins";

import { db } from "@acme/db/client";

interface AuthLogger {
  info: (obj: unknown, msg: string) => void;
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
      anonymous({
        emailDomainName: "anon.wearbloom.app",
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          // TODO: Enable when renders table exists (Story 3.2)
          // await db.update(renders).set({ userId: newUser.user.id }).where(eq(renders.userId, anonymousUser.user.id));
          options.logger.info(
            {
              anonymousUserId: anonymousUser.user.id,
              newUserId: newUser.user.id,
            },
            "Anonymous account linked",
          );
        },
      }),
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
    rateLimit: {
      customRules: {
        "/sign-in/anonymous": {
          window: 60,
          max: 5,
        },
      },
    },
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
