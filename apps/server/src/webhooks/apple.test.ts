import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAppleWebhookHandler } from "./apple";

describe("Apple Webhook Handler", () => {
  const mockVerifier = {
    verifyAndDecodeNotification: mock(() =>
      Promise.resolve({
        notificationType: "TEST" as string,
        subtype: undefined as string | undefined,
        data: undefined as
          | { signedTransactionInfo?: string; signedRenewalInfo?: string }
          | undefined,
      }),
    ),
    verifyAndDecodeTransaction: mock(() =>
      Promise.resolve({
        originalTransactionId: "orig-txn-1",
        transactionId: "txn-1",
        productId: "com.wearbloom.weekly",
        expiresDate: Date.now() + 7 * 86400000,
        appAccountToken: "user-123",
        purchaseDate: Date.now(),
      } as Record<string, unknown>),
    ),
  };

  const mockSubscriptionManager = {
    getSubscription: mock(() => Promise.resolve(undefined)),
    upsertSubscription: mock(() =>
      Promise.resolve({
        id: "sub-1",
        userId: "user-123",
        status: "subscribed",
        expiresAt: new Date(Date.now() + 7 * 86400000),
      }),
    ),
    updateStatus: mock(() => Promise.resolve()),
    computeSubscriptionState: mock(() => ({
      state: "subscribed",
      isSubscriber: true,
      rendersAllowed: true,
      isUnlimited: true,
    })),
    determineSubscriptionStatus: mock(() => "subscribed" as const),
  };

  const mockLogger = {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };

  let handler: ReturnType<typeof createAppleWebhookHandler>;

  beforeEach(() => {
    mock.restore();
    handler = createAppleWebhookHandler({
      verifier: mockVerifier as Parameters<
        typeof createAppleWebhookHandler
      >[0]["verifier"],
      subscriptionManager:
        mockSubscriptionManager as unknown as Parameters<
          typeof createAppleWebhookHandler
        >[0]["subscriptionManager"],
      logger: mockLogger as Parameters<
        typeof createAppleWebhookHandler
      >[0]["logger"],
    });
  });

  afterEach(() => {
    mock.restore();
  });

  test("returns 200 for TEST notification", async () => {
    const result = await handler.handleNotification("signed-payload-test");
    expect(result.status).toBe(200);
  });

  test("returns 400 when verification fails", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.reject(new Error("Invalid signature")),
    );

    const result = await handler.handleNotification("invalid-payload");
    expect(result.status).toBe(400);
  });

  test("handles SUBSCRIBED INITIAL_BUY notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "SUBSCRIBED",
        subtype: "INITIAL_BUY",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.upsertSubscription).toHaveBeenCalled();
  });

  test("handles EXPIRED notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "EXPIRED",
        subtype: "VOLUNTARY",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalled();
  });

  test("handles DID_RENEW notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_RENEW",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
  });

  test("handles REFUND notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "REFUND",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalled();
  });

  test("handles DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_DISABLED", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_CHANGE_RENEWAL_STATUS",
        subtype: "AUTO_RENEW_DISABLED",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalled();
  });
});
