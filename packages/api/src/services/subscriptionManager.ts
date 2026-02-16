import { TRPCError } from "@trpc/server";

import type { InferSelectModel } from "@acme/db";
import { eq } from "@acme/db";

import { subscriptions } from "@acme/db/schema";

import type { db as dbType } from "@acme/db/client";

type Subscription = InferSelectModel<typeof subscriptions>;
type SubscriptionStatusValue = "trial" | "subscribed" | "expired" | "cancelled" | "grace_period";

export type SubscriptionStateName =
  | "no_subscription"
  | SubscriptionStatusValue;

export interface SubscriptionState {
  state: SubscriptionStateName;
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

      // Grace period: subscriber retains access while Apple retries billing
      if (status === "grace_period") {
        return {
          state: "grace_period",
          isSubscriber: true,
          rendersAllowed: true,
          isUnlimited: true,
        };
      }

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
      const row = rows[0];
      if (!row) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "UPSERT_FAILED" });
      }
      return row;
    },

    async updateStatus(
      userId: string,
      status: SubscriptionStatusValue,
      expiresAt?: Date,
    ): Promise<void> {
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
