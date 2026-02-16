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
 * Handles subscription lifecycle events: RENEWAL, CANCEL, EXPIRED, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED
 * See: https://developer.apple.com/documentation/appstoreservernotiticationsv2/
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
        return { status: 400, body: { error: "INVALID_SIGNATURE" } };
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
      const originalTransactionId = transaction.originalTransactionId as string;
      const transactionId = transaction.transactionId as string;
      const productId = transaction.productId as string;

      // Handle App Store Server Notifications V2 event types
      // https://developer.apple.com/documentation/appstoreservernotiticationsv2/notificationtype
      switch (notificationType) {
        case "RENEWAL": {
          // AC#3: Subscription renewal event
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
            "Apple webhook: subscription renewal event processed",
          );
          break;
        }

        case "CANCEL": {
          // AC#4: Subscription cancellation event
          // User cancelled subscription via iOS Settings
          // Status set to "cancelled" but expires_at preserved
          // User retains access until current period ends
          const currentSubscription =
            await subscriptionManager.getSubscription(userId);
          const expiresAt = currentSubscription?.expiresAt || new Date();

          await subscriptionManager.updateStatus(userId, "cancelled", expiresAt);

          logger.info(
            { userId, subtype },
            "Apple webhook: subscription cancelled by user — access retained until period end",
          );
          break;
        }

        case "EXPIRED": {
          // AC#5: Subscription expiration event
          // Period expired without renewal
          // Status transitions to "expired"
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId, subtype },
            "Apple webhook: subscription period expired",
          );
          break;
        }

        case "DID_FAIL_TO_RENEW": {
          // AC#6: Billing issue — Apple handles retry
          // Grace period is managed by Apple automatically
          // Log but don't change status yet
          logger.warn(
            { userId, subtype },
            "Apple webhook: renewal failed — grace period in progress",
          );
          break;
        }

        case "GRACE_PERIOD_EXPIRED": {
          // AC#6: Grace period ended without successful renewal
          // Transition to expired state
          await subscriptionManager.updateStatus(userId, "expired");

          logger.info(
            { userId },
            "Apple webhook: grace period expired — subscription now expired",
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
