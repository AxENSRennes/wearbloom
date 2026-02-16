import type { createSubscriptionManager } from "@acme/api/services/subscriptionManager";

interface WebhookVerifier {
  verifyAndDecodeNotification: (
    signedPayload: string,
  ) => Promise<{
    notificationType?: string;
    subtype?: string;
    data?: {
      signedTransactionInfo?: string;
      signedRenewalInfo?: string;
    };
  }>;
  verifyAndDecodeTransaction: (
    signedTransaction: string,
  ) => Promise<Record<string, unknown>>;
}

interface WebhookLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (obj: Record<string, unknown>, msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

type SubscriptionManager = ReturnType<typeof createSubscriptionManager>;

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
  ): Promise<Record<string, unknown> | null> {
    if (!data?.signedTransactionInfo) {
      return null;
    }
    return verifier.verifyAndDecodeTransaction(data.signedTransactionInfo);
  }

  return {
    async handleNotification(
      signedPayload: string,
    ): Promise<WebhookResult> {
      let notification;
      try {
        notification =
          await verifier.verifyAndDecodeNotification(signedPayload);
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

      const transaction = await extractTransaction(
        data as { signedTransactionInfo?: string } | undefined,
      );
      if (!transaction) {
        logger.warn(
          { notificationType },
          "Apple webhook: no transaction data in notification",
        );
        return { status: 200, body: { received: true, skipped: true } };
      }

      const appAccountToken = transaction.appAccountToken as
        | string
        | undefined;
      if (!appAccountToken) {
        logger.warn(
          { notificationType, transactionId: transaction.transactionId },
          "Apple webhook: no appAccountToken — cannot identify user",
        );
        return { status: 200, body: { received: true, skipped: true } };
      }

      const userId = appAccountToken;
      const expiresDate = transaction.expiresDate as number | undefined;
      const purchaseDate = transaction.purchaseDate as number | undefined;
      const originalTransactionId = transaction.originalTransactionId as
        | string
        | undefined;
      const transactionId = transaction.transactionId as string | undefined;
      const productId = transaction.productId as string | undefined;

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
              : new Date(Date.now() + 7 * 86400000),
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
              : new Date(Date.now() + 7 * 86400000),
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
          // Transition to grace_period so user retains access during retry
          await subscriptionManager.updateStatus(userId, "grace_period");

          logger.warn(
            { userId, subtype },
            "Apple webhook: renewal failed — grace period started",
          );
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
