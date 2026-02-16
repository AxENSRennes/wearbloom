import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { createCreditService } from "../services/creditService";
import { createSubscriptionManager } from "../services/subscriptionManager";
import { protectedProcedure } from "../trpc";

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

  consumeCredit: protectedProcedure.mutation(async ({ ctx }) => {
    const creditService = createCreditService({ db: ctx.db });
    const result = await creditService.consumeCredit(ctx.session.user.id);

    if (!result.success) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "INSUFFICIENT_CREDITS",
      });
    }

    return { remaining: result.remaining };
  }),

  refundCredit: protectedProcedure.mutation(async ({ ctx }) => {
    const creditService = createCreditService({ db: ctx.db });
    await creditService.refundCredit(ctx.session.user.id);
    return { success: true };
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

    let state: string;
    if (isSubscriber) {
      state = subState.state;
    } else if (balance.remaining > 0) {
      state = "free_with_credits";
    } else {
      state = "free_no_credits";
    }

    return {
      isSubscriber,
      creditsRemaining: balance.remaining,
      state,
      canRender,
    };
  }),

  // === Story 4.2: IAP procedures ===

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const subManager = createSubscriptionManager({ db: ctx.db });
    const subscription = await subManager.getSubscription(ctx.session.user.id);
    const subState = subManager.computeSubscriptionState(
      subscription
        ? { status: subscription.status, expiresAt: subscription.expiresAt }
        : null,
    );

    // AC#8: Detect if user previously subscribed (for resubscribe messaging)
    // User is considered a previous subscriber if a subscription record exists
    // This enables resubscribe CTA instead of "Start Free Trial" for lapsed users
    const hadSubscription = subscription !== undefined;

    return {
      ...subState,
      expiresAt: subscription?.expiresAt ?? null,
      productId: subscription?.productId ?? null,
      hadSubscription,
    };
  }),

  verifyPurchase: protectedProcedure
    .input(
      z.object({
        signedTransactionInfo: z.string(),
      }),
    )
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

      // Validate appAccountToken matches authenticated user
      const appAccountToken = decoded.appAccountToken as string | undefined;
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
      const transactionId = decoded.transactionId as string;
      const originalTransactionId = decoded.originalTransactionId as string;
      const productId = decoded.productId as string;
      const expiresDate = decoded.expiresDate as number | undefined;
      const purchaseDate = decoded.purchaseDate as number | undefined;

      // Determine if this is an initial buy with trial
      const existingSub = await subManager.getSubscription(ctx.session.user.id);
      const isInitialBuy = !existingSub;
      // StoreKit 2: offerType 1 = introductory offer (free trial)
      const hasTrial = isInitialBuy && decoded.offerType === 1;

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
            : new Date(Date.now() + 7 * 86400000),
        },
      );

      return {
        status: subscription.status,
        expiresAt: subscription.expiresAt,
        productId: subscription.productId,
      };
    }),

  restorePurchases: protectedProcedure
    .input(
      z.object({
        signedTransactions: z.array(z.string()),
      }),
    )
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

        const expiresDate = decoded.expiresDate as number | undefined;
        if (!expiresDate || expiresDate < Date.now()) continue; // skip expired

        const purchaseDate = decoded.purchaseDate as number | undefined;

        await subManager.upsertSubscription(ctx.session.user.id, {
          appleTransactionId: decoded.transactionId as string,
          appleOriginalTransactionId:
            decoded.originalTransactionId as string,
          productId: decoded.productId as string,
          status: "subscribed",
          startedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
          expiresAt: new Date(expiresDate),
        });
        restored++;
      }

      return { restored, failed };
    }),
} satisfies TRPCRouterRecord;
