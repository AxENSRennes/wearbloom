import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { restorePurchasesSchema, verifyPurchaseSchema } from "@acme/validators";

import type { SubscriptionStateName } from "../services/subscriptionManager";
import { createCreditService } from "../services/creditService";
import { createSubscriptionManager } from "../services/subscriptionManager";
import { protectedProcedure } from "../trpc";

/** Fallback expiry when Apple transaction has no expiresDate (7 days). */
const DEFAULT_EXPIRY_MS = 7 * 86_400_000;

const decodedTransactionSchema = z.object({
  appAccountToken: z.string().optional(),
  transactionId: z.string().optional(),
  originalTransactionId: z.string().optional(),
  productId: z.string().optional(),
  expiresDate: z.coerce.number().optional(),
  purchaseDate: z.coerce.number().optional(),
  offerType: z.coerce.number().optional(),
});

export const subscriptionRouter = {
  getCredits: protectedProcedure.query(async ({ ctx }) => {
    const creditService = createCreditService({ db: ctx.db });
    return creditService.getCreditBalance(ctx.session.user.id);
  }),

  grantInitialCredits: protectedProcedure.mutation(async ({ ctx }) => {
    const creditService = createCreditService({ db: ctx.db });
    await creditService.grantFreeCredits(
      ctx.session.user.id,
      ctx.freeCreditsCount,
    );
    return creditService.getCreditBalance(ctx.session.user.id);
  }),

  getSubscriptionStatus: protectedProcedure.query(async ({ ctx }) => {
    const creditService = createCreditService({ db: ctx.db });
    const subManager = createSubscriptionManager({ db: ctx.db });

    const balance = await creditService.getCreditBalance(ctx.session.user.id);
    const subscription = await subManager.getSubscription(ctx.session.user.id);
    const subState = subManager.computeSubscriptionState(
      subscription
        ? { status: subscription.status, expiresAt: subscription.expiresAt }
        : null,
    );

    const isSubscriber = subState.isSubscriber;
    const canRender = isSubscriber || balance.remaining > 0;

    let state: SubscriptionStateName | "free_with_credits" | "free_no_credits";
    if (isSubscriber) {
      state = subState.state;
    } else if (
      subscription &&
      (subState.state === "expired" || subState.state === "cancelled")
    ) {
      state = subState.state;
    } else if (balance.remaining > 0) {
      state = "free_with_credits";
    } else {
      state = "free_no_credits";
    }

    const hadSubscription = subscription !== undefined;

    return {
      isSubscriber,
      creditsRemaining: balance.remaining,
      state,
      canRender,
      rendersAllowed: subState.rendersAllowed,
      isUnlimited: subState.isUnlimited,
      expiresAt: subscription?.expiresAt ?? null,
      productId: subscription?.productId ?? null,
      hadSubscription,
    };
  }),

  // === Story 4.2: IAP procedures ===

  verifyPurchase: protectedProcedure
    .input(verifyPurchaseSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.appleIap) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "APPLE_IAP_NOT_CONFIGURED",
        });
      }

      const decoded = await ctx.appleIap.verifier
        .verifyAndDecodeTransaction(input.signedTransactionInfo)
        .catch((err: unknown) => {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "INVALID_TRANSACTION",
            cause: err,
          });
        });

      const parsedDecoded = decodedTransactionSchema.safeParse(decoded);
      if (!parsedDecoded.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_TRANSACTION_DATA",
          cause: parsedDecoded.error,
        });
      }
      const decodedData = parsedDecoded.data;

      // Validate appAccountToken matches authenticated user
      const { appAccountToken } = decodedData;
      if (!appAccountToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MISSING_APP_ACCOUNT_TOKEN",
        });
      }
      if (appAccountToken !== ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "TRANSACTION_USER_MISMATCH",
        });
      }

      const subManager = createSubscriptionManager({ db: ctx.db });
      const { transactionId, originalTransactionId, productId } = decodedData;

      if (!transactionId || !originalTransactionId || !productId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_TRANSACTION_DATA",
        });
      }

      const { expiresDate, purchaseDate } = decodedData;

      // Determine if this is an initial buy with trial
      const existingSub = await subManager.getSubscription(ctx.session.user.id);
      const isInitialBuy = !existingSub;
      // StoreKit 2: offerType 1 = introductory offer (free trial)
      const hasTrial = isInitialBuy && decodedData.offerType === 1;

      const status = subManager.determineSubscriptionStatus({
        isInitialBuy,
        hasTrial,
      });

      const subscription = await subManager.upsertSubscription(
        ctx.session.user.id,
        {
          appleTransactionId: transactionId,
          appleOriginalTransactionId: originalTransactionId,
          productId,
          status,
          startedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
          expiresAt: expiresDate
            ? new Date(expiresDate)
            : new Date(Date.now() + DEFAULT_EXPIRY_MS),
        },
      );

      return {
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        productId: subscription.productId,
      };
    }),

  restorePurchases: protectedProcedure
    .input(restorePurchasesSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.signedTransactions.length === 0) {
        return { restored: 0 };
      }

      if (!ctx.appleIap) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "APPLE_IAP_NOT_CONFIGURED",
        });
      }

      const subManager = createSubscriptionManager({ db: ctx.db });
      let restored = 0;
      let failed = 0;

      for (const signedTransaction of input.signedTransactions) {
        const decoded = await ctx.appleIap.verifier
          .verifyAndDecodeTransaction(signedTransaction)
          .catch(() => {
            failed++;
            return null;
          });

        if (!decoded) continue;
        const parsedDecoded = decodedTransactionSchema.safeParse(decoded);
        if (!parsedDecoded.success) {
          failed++;
          continue;
        }
        const decodedData = parsedDecoded.data;

        // Validate appAccountToken matches authenticated user
        // Skip transactions without appAccountToken to prevent cross-user subscription theft
        const { appAccountToken } = decodedData;
        if (!appAccountToken || appAccountToken !== ctx.session.user.id)
          continue;

        const { expiresDate } = decodedData;
        if (!expiresDate || expiresDate < Date.now()) continue; // skip expired

        const {
          purchaseDate,
          transactionId,
          originalTransactionId,
          productId,
        } = decodedData;
        if (!transactionId || !originalTransactionId || !productId) {
          failed++;
          continue;
        }

        await subManager.upsertSubscription(ctx.session.user.id, {
          appleTransactionId: transactionId,
          appleOriginalTransactionId: originalTransactionId,
          productId,
          status: "subscribed",
          startedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
          expiresAt: new Date(expiresDate),
        });
        restored++;
      }

      return { restored, failed };
    }),
} satisfies TRPCRouterRecord;
