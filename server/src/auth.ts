import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { appleClientSecret } from "./apple-auth";
import type { AppConfig } from "./config";
import type { Database } from "./db/client";
import * as schema from "./db/schema";

export function createAuth(config: AppConfig, db: Database) {
  const hasApple = Boolean(
    config.APPLE_CLIENT_ID && config.APPLE_TEAM_ID && config.APPLE_KEY_ID && config.APPLE_PRIVATE_KEY,
  );

  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    trustedOrigins: [config.PUBLIC_APP_URL, "https://appleid.apple.com"],
    socialProviders: hasApple ? {
      apple: async () => ({
        clientId: config.APPLE_CLIENT_ID!,
        clientSecret: await appleClientSecret(config),
        appBundleIdentifier: "com.axel.wearbloom",
      }),
    } : {},
    plugins: [anonymous({
      emailDomainName: "anonymous.wearbloom.app",
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        const oldOwnerId = anonymousUser.user.id;
        const newOwnerId = newUser.user.id;
        await db.transaction(async (transaction) => {
          await transaction.update(schema.assets).set({ ownerId: newOwnerId }).where(eq(schema.assets.ownerId, oldOwnerId));
          await transaction.update(schema.garments).set({ ownerId: newOwnerId }).where(eq(schema.garments.ownerId, oldOwnerId));
          await transaction.update(schema.referencePhotos).set({ ownerId: newOwnerId }).where(eq(schema.referencePhotos.ownerId, oldOwnerId));
          await transaction.update(schema.looks).set({ ownerId: newOwnerId }).where(eq(schema.looks.ownerId, oldOwnerId));
          await transaction.update(schema.renderVariants).set({ ownerId: newOwnerId }).where(eq(schema.renderVariants.ownerId, oldOwnerId));
          await transaction.update(schema.quotaLedger).set({ ownerId: newOwnerId }).where(eq(schema.quotaLedger.ownerId, oldOwnerId));
          await transaction.update(schema.idempotencyKeys).set({ ownerId: newOwnerId }).where(eq(schema.idempotencyKeys.ownerId, oldOwnerId));
          await transaction.update(schema.appAttestChallenges).set({ ownerId: newOwnerId }).where(eq(schema.appAttestChallenges.ownerId, oldOwnerId));
          await transaction.update(schema.appAttestKeys).set({ ownerId: newOwnerId }).where(eq(schema.appAttestKeys.ownerId, oldOwnerId));
          const [oldEntitlement] = await transaction.select().from(schema.entitlements).where(eq(schema.entitlements.ownerId, oldOwnerId)).limit(1);
          const [newEntitlement] = await transaction.select().from(schema.entitlements).where(eq(schema.entitlements.ownerId, newOwnerId)).limit(1);
          if (oldEntitlement && newEntitlement) {
            const expirations = [oldEntitlement.expiresAt, newEntitlement.expiresAt].filter((date): date is Date => date !== null);
            await transaction.update(schema.entitlements).set({
              isPro: oldEntitlement.isPro || newEntitlement.isPro,
              expiresAt: expirations.sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
              updatedAt: new Date(),
            }).where(eq(schema.entitlements.ownerId, newOwnerId));
            await transaction.delete(schema.entitlements).where(eq(schema.entitlements.ownerId, oldOwnerId));
          } else if (oldEntitlement) {
            await transaction.update(schema.entitlements).set({ ownerId: newOwnerId, revenueCatAppUserId: newOwnerId }).where(eq(schema.entitlements.ownerId, oldOwnerId));
          }
        });
      },
    })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
