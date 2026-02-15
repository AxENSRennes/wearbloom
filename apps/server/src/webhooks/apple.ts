import type { createSubscriptionManager } from "@acme/api/services/subscriptionManager";

interface WebhookVerifier {
  verifyAndDecodeNotification: (signedPayload: string) => Promise<{
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
    if (!data?.signedTransactionInfo) return null;
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

      switch (notificationType) {
        case "SUBSCRIBED": {
          const isInitialBuy = subtype === "INITIAL_BUY";
          const hasTrial =
            isInitialBuy &&
            !!expiresDate &&
            !!purchaseDate &&
            expiresDate - purchaseDate > 2 * 86400000;

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
            "Apple webhook: subscription created/updated",
          );
          break;
        }

        case "DID_RENEW": {
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
            "Apple webhook: subscription renewed",
          );
          break;
        }

        case "EXPIRED":
        case "GRACE_PERIOD_EXPIRED": {
          await subscriptionManager.updateStatus(userId, "expired");
          logger.info(
            { userId, subtype },
            "Apple webhook: subscription expired",
          );
          break;
        }

        case "DID_FAIL_TO_RENEW": {
          // Apple handles retry — log but don't change status yet
          logger.warn(
            { userId, subtype },
            "Apple webhook: renewal failed, Apple retry in progress",
          );
          break;
        }

        case "DID_CHANGE_RENEWAL_STATUS": {
          if (subtype === "AUTO_RENEW_DISABLED") {
            await subscriptionManager.updateStatus(userId, "cancelled");
            logger.info(
              { userId },
              "Apple webhook: auto-renew disabled — marked cancelled",
            );
          } else if (subtype === "AUTO_RENEW_ENABLED") {
            // Check if not expired before restoring
            const sub = await subscriptionManager.getSubscription(userId);
            if (sub && sub.expiresAt && sub.expiresAt > new Date()) {
              await subscriptionManager.updateStatus(userId, "subscribed");
              logger.info(
                { userId },
                "Apple webhook: auto-renew re-enabled — restored to subscribed",
              );
            }
          }
          break;
        }

        case "REFUND":
        case "REVOKE": {
          await subscriptionManager.updateStatus(userId, "expired");
          logger.info(
            { userId, notificationType },
            "Apple webhook: access revoked",
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
