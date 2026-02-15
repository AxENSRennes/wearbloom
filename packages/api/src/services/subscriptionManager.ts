import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import type { subscriptions } from "@acme/db/schema";

import type { db as dbType } from "@acme/db/client";

type Subscription = InferSelectModel<typeof subscriptions>;
type SubscriptionStatusValue = "trial" | "subscribed" | "expired" | "cancelled";

export interface SubscriptionState {
  state: string;
  isSubscriber: boolean;
  rendersAllowed: boolean;
  isUnlimited: boolean;
}

interface SubscriptionInput {
  status: SubscriptionStatusValue;
  expiresAt: Date | null;
}

interface DetermineStatusInput {
  isInitialBuy: boolean;
  hasTrial: boolean;
}

export function createSubscriptionManager({ db }: { db: typeof dbType }) {
  return {
    computeSubscriptionState(
      subscription: SubscriptionInput | null,
    ): SubscriptionState {
      if (!subscription) {
        return {
          state: "no_subscription",
          isSubscriber: false,
          rendersAllowed: false,
          isUnlimited: false,
        };
      }

      const { status, expiresAt } = subscription;
      const now = new Date();
      const isExpired =
        status === "expired" || (expiresAt !== null && expiresAt < now);

      if (isExpired) {
        return {
          state: "expired",
          isSubscriber: false,
          rendersAllowed: false,
          isUnlimited: false,
        };
      }

      // Active subscription (trial, subscribed, or cancelled but not yet expired)
      return {
        state: status,
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      };
    },

    determineSubscriptionStatus(
      input: DetermineStatusInput,
    ): SubscriptionStatusValue {
      if (input.isInitialBuy && input.hasTrial) {
        return "trial";
      }
      return "subscribed";
    },

    async getSubscription(userId: string): Promise<Subscription | undefined> {
      const { subscriptions } = await import("@acme/db/schema");
      const rows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));
      return rows[0];
    },

    async upsertSubscription(
      userId: string,
      data: {
        appleTransactionId: string;
        appleOriginalTransactionId: string;
        productId: string;
        status: SubscriptionStatusValue;
        startedAt: Date;
        expiresAt: Date;
      },
    ): Promise<Subscription> {
      const { subscriptions } = await import("@acme/db/schema");
      const rows = await db
        .insert(subscriptions)
        .values({
          userId,
          appleTransactionId: data.appleTransactionId,
          appleOriginalTransactionId: data.appleOriginalTransactionId,
          productId: data.productId,
          status: data.status,
          startedAt: data.startedAt,
          expiresAt: data.expiresAt,
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: {
            appleTransactionId: data.appleTransactionId,
            status: data.status,
            expiresAt: data.expiresAt,
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0] as Subscription;
    },

    async updateStatus(
      userId: string,
      status: SubscriptionStatusValue,
      expiresAt?: Date,
    ): Promise<void> {
      const { subscriptions } = await import("@acme/db/schema");
      await db
        .update(subscriptions)
        .set({
          status,
          ...(expiresAt !== undefined ? { expiresAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
    },
  };
}
