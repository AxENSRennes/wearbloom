import { z } from "zod/v4";

import type { createSubscriptionManager } from "@acme/api/services/subscriptionManager";

const appleNotificationSchema = z.object({
  notificationType: z.string().optional(),
  subtype: z.string().optional(),
  data: z
    .object({
      signedTransactionInfo: z.string().optional(),
      signedRenewalInfo: z.string().optional(),
    })
    .optional(),
});

const decodedTransactionSchema = z.object({
  appAccountToken: z.string().optional(),
  expiresDate: z.coerce.number().optional(),
  purchaseDate: z.coerce.number().optional(),
  originalTransactionId: z.string().optional(),
  transactionId: z.string().optional(),
  productId: z.string().optional(),
  offerType: z.coerce.number().optional(),
});

interface WebhookVerifier {
  verifyAndDecodeNotification: (signedPayload: string) => Promise<unknown>;
  verifyAndDecodeTransaction: (signedTransaction: string) => Promise<unknown>;
}

interface WebhookLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

type SubscriptionManager = ReturnType<typeof createSubscriptionManager>;

/** Fallback expiry when Apple transaction has no expiresDate (7 days). */
const DEFAULT_EXPIRY_MS = 7 * 86_400_000;

interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Apple App Store Server Notifications V2 handler
 * Handles subscription lifecycle events: SUBSCRIBED, DID_RENEW, DID_CHANGE_RENEWAL_STATUS,
 * EXPIRED, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, REFUND, REVOKE
 * See: https://developer.apple.com/documentation/appstoreservernotifications
 */
export function createAppleWebhookHandler({
  verifier,
  subscriptionManager,
  logger,
}: {
  verifier: WebhookVerifier;
  subscriptionManager: SubscriptionManager;
  logger: WebhookLogger;
}) {
  async function extractTransaction(
    data: { signedTransactionInfo?: string } | undefined,
  ): Promise<z.infer<typeof decodedTransactionSchema> | null> {
    if (!data?.signedTransactionInfo) {
      return null;
    }

    const decoded = await verifier.verifyAndDecodeTransaction(
      data.signedTransactionInfo,
    );
    const parsedTransaction = decodedTransactionSchema.safeParse(decoded);
    if (!parsedTransaction.success) {
      logger.warn(
        { error: parsedTransaction.error.flatten() },
        "Apple webhook: invalid decoded transaction payload",
      );
      return null;
    }

    return parsedTransaction.data;
  }

  return {
    async handleNotification(signedPayload: string): Promise<WebhookResult> {
      let notification: z.infer<typeof appleNotificationSchema>;
      try {
        const decoded =
          await verifier.verifyAndDecodeNotification(signedPayload);
        notification = appleNotificationSchema.parse(decoded);
      } catch (err) {
        logger.error(
          { error: String(err) },
          "Apple webhook: JWS verification failed",
        );
        return { status: 401, body: { error: "INVALID_SIGNATURE" } };
      }

      const { notificationType, subtype, data } = notification;

      logger.info(
        { notificationType, subtype },
        "Apple webhook: notification received",
      );

      // TEST notification — no action needed
      if (notificationType === "TEST") {
        logger.info({}, "Apple webhook: test notification received");
        return { status: 200, body: { received: true } };
      }

      const transaction = await extractTransaction(data);
      if (!transaction) {
        logger.warn(
          { notificationType },
          "Apple webhook: no transaction data in notification",
        );
        return { status: 200, body: { received: true, skipped: true } };
      }

      const { appAccountToken } = transaction;
      if (!appAccountToken) {
        logger.warn(
          { notificationType, transactionId: transaction.transactionId },
          "Apple webhook: no appAccountToken — cannot identify user",
        );
        return { status: 200, body: { received: true, skipped: true } };
      }

      const userId = appAccountToken;
      const { expiresDate, purchaseDate } = transaction;
      const { originalTransactionId, transactionId, productId } = transaction;

      if (!originalTransactionId || !transactionId || !productId) {
        logger.warn(
          { notificationType, originalTransactionId, transactionId, productId },
          "Apple webhook: missing required transaction fields",
        );
        return { status: 200, body: { received: true, skipped: true } };
      }

      // Handle App Store Server Notifications V2 event types
      // https://developer.apple.com/documentation/appstoreservernotifications/notificationtype
      switch (notificationType) {
        case "SUBSCRIBED": {
          // AC#3: New subscription or resubscribe
          // Subtypes: INITIAL_BUY (first purchase), RESUBSCRIBE (lapsed user returns)
          const isInitialBuy = subtype === "INITIAL_BUY";
          // StoreKit 2: offerType 1 = introductory offer (free trial)
          const hasTrial = isInitialBuy && transaction.offerType === 1;

          const status = subscriptionManager.determineSubscriptionStatus({
            isInitialBuy,
            hasTrial,
          });

          await subscriptionManager.upsertSubscription(userId, {
            appleTransactionId: transactionId,
            appleOriginalTransactionId: originalTransactionId,
            productId,
            status,
            startedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
            expiresAt: expiresDate
              ? new Date(expiresDate)
              : new Date(Date.now() + DEFAULT_EXPIRY_MS),
          });

          logger.info(
            { userId, status, subtype },
            "Apple webhook: subscription event processed",
          );
          break;
        }

        case "DID_RENEW": {
          // Auto-renewal succeeded
          // Subtypes: none (normal renewal), BILLING_RECOVERY (after failed billing)
          await subscriptionManager.upsertSubscription(userId, {
            appleTransactionId: transactionId,
            appleOriginalTransactionId: originalTransactionId,
            productId,
            status: "subscribed",
            startedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
            expiresAt: expiresDate
              ? new Date(expiresDate)
              : new Date(Date.now() + DEFAULT_EXPIRY_MS),
          });

          logger.info(
            { userId, subtype },
            "Apple webhook: subscription auto-renewed",
          );
          break;
        }

        case "DID_CHANGE_RENEWAL_STATUS": {
          // AC#4: User changed auto-renew preference
          // Subtype AUTO_RENEW_DISABLED = user cancelled via iOS Settings
          // Subtype AUTO_RENEW_ENABLED = user re-enabled auto-renew
          if (subtype === "AUTO_RENEW_DISABLED") {
            const currentSubscription =
              await subscriptionManager.getSubscription(userId);

            if (!currentSubscription) {
              logger.warn(
                { userId },
                "Apple webhook: DID_CHANGE_RENEWAL_STATUS received but no subscription found — skipping",
              );
              return { status: 200, body: { received: true, skipped: true } };
            }

            await subscriptionManager.updateStatus(
              userId,
              "cancelled",
              currentSubscription.expiresAt ?? undefined,
            );

            logger.info(
              { userId, subtype },
              "Apple webhook: subscription cancelled by user — access retained until period end",
            );
          } else if (subtype === "AUTO_RENEW_ENABLED") {
            const currentSubscription =
              await subscriptionManager.getSubscription(userId);

            if (!currentSubscription) {
              logger.warn(
                { userId },
                "Apple webhook: AUTO_RENEW_ENABLED received but no subscription found — skipping",
              );
              return { status: 200, body: { received: true, skipped: true } };
            }

            if (currentSubscription.status === "cancelled") {
              await subscriptionManager.updateStatus(userId, "subscribed");

              logger.info(
                { userId, subtype },
                "Apple webhook: auto-renew re-enabled — status reverted from cancelled to subscribed",
              );
            } else {
              logger.info(
                { userId, subtype, currentStatus: currentSubscription.status },
                "Apple webhook: auto-renew re-enabled — no status change needed",
              );
            }
          } else {
            logger.info(
              { userId, subtype },
              "Apple webhook: auto-renew status changed",
            );
          }
          break;
        }

        case "EXPIRED": {
          // AC#5: Subscription expiration event
          // Period expired without renewal
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId, subtype },
            "Apple webhook: subscription period expired",
          );
          break;
        }

        case "DID_FAIL_TO_RENEW": {
          // AC#6: Billing issue — Apple is retrying
          // Only grant grace_period access when Apple sends GRACE_PERIOD subtype
          // (requires Billing Grace Period enabled in App Store Connect)
          if (subtype === "GRACE_PERIOD") {
            await subscriptionManager.updateStatus(userId, "grace_period");

            logger.warn(
              { userId, subtype },
              "Apple webhook: renewal failed — grace period started",
            );
          } else {
            logger.warn(
              { userId, subtype },
              "Apple webhook: renewal failed — billing retry in progress (no grace period)",
            );
          }
          break;
        }

        case "GRACE_PERIOD_EXPIRED": {
          // AC#6: Grace period ended without successful renewal
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId },
            "Apple webhook: grace period expired — subscription now expired",
          );
          break;
        }

        case "REFUND": {
          // Customer received a refund — revoke access immediately
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId, transactionId },
            "Apple webhook: refund processed — access revoked",
          );
          break;
        }

        case "REVOKE": {
          // Family sharing revocation or App Store fraud — revoke access immediately
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId, transactionId },
            "Apple webhook: subscription revoked — access revoked",
          );
          break;
        }

        default: {
          logger.info(
            { notificationType, subtype },
            "Apple webhook: unhandled notification type",
          );
        }
      }

      return { status: 200, body: { received: true } };
    },
  };
}
