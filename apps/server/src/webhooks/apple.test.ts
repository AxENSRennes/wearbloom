import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createAppleWebhookHandler } from "./apple";

describe("Apple Webhook Handler (V2)", () => {
  let mockVerifier: ReturnType<typeof createMockVerifier>;
  let mockSubscriptionManager: ReturnType<
    typeof createMockSubscriptionManager
  >;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let handler: ReturnType<typeof createAppleWebhookHandler>;

  function createMockVerifier() {
    return {
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
  }

  function createMockSubscriptionManager() {
    return {
      getSubscription: mock(async () =>
        Promise.resolve<
          | {
              id: string;
              userId: string;
              status: string;
              expiresAt: Date;
              appleTransactionId: string;
              appleOriginalTransactionId: string;
              productId: string;
              startedAt: Date;
              createdAt: Date;
              updatedAt: Date;
            }
          | undefined
        >({
          id: "sub-1",
          userId: "user-123",
          status: "subscribed" as const,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          appleTransactionId: "txn-1",
          appleOriginalTransactionId: "orig-txn-1",
          productId: "com.wearbloom.weekly",
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      upsertSubscription: mock(async () =>
        Promise.resolve({
          id: "sub-1",
          userId: "user-123",
          status: "subscribed" as const,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          appleTransactionId: "txn-1",
          appleOriginalTransactionId: "orig-txn-1",
          productId: "com.wearbloom.weekly",
          startedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      updateStatus: mock(async () => Promise.resolve()),
      computeSubscriptionState: mock(() => ({
        state: "subscribed",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      })),
      determineSubscriptionStatus: mock(() => "subscribed" as const),
    };
  }

  function createMockLogger() {
    return {
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    };
  }

  beforeEach(() => {
    mockVerifier = createMockVerifier();
    mockSubscriptionManager = createMockSubscriptionManager();
    mockLogger = createMockLogger();
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

  test("returns 401 when verification fails", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.reject(new Error("Invalid signature")),
    );

    const result = await handler.handleNotification("invalid-payload");
    expect(result.status).toBe(401);
  });

  test("AC#3: handles SUBSCRIBED INITIAL_BUY notification (subscription created)", async () => {
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

  test("AC#3: handles SUBSCRIBED RESUBSCRIBE notification (user resubscribes)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "SUBSCRIBED",
        subtype: "RESUBSCRIBE",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.upsertSubscription).toHaveBeenCalled();
  });

  test("handles DID_RENEW notification (auto-renewal succeeded)", async () => {
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
    expect(mockSubscriptionManager.upsertSubscription).toHaveBeenCalled();
  });

  test("handles DID_RENEW BILLING_RECOVERY notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_RENEW",
        subtype: "BILLING_RECOVERY",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.upsertSubscription).toHaveBeenCalled();
  });

  test("AC#4: handles DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_DISABLED (user cancelled)", async () => {
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
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "cancelled",
      expect.any(Date),
    );
  });

  test("AC#4: handles DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_ENABLED — reverts cancelled to subscribed", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_CHANGE_RENEWAL_STATUS",
        subtype: "AUTO_RENEW_ENABLED",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    // Simulate a user who previously cancelled
    mockSubscriptionManager.getSubscription.mockImplementation(() =>
      Promise.resolve({
        id: "sub-1",
        userId: "user-123",
        status: "cancelled" as const,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        appleTransactionId: "txn-1",
        appleOriginalTransactionId: "orig-txn-1",
        productId: "com.wearbloom.weekly",
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.getSubscription).toHaveBeenCalledWith("user-123");
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "subscribed",
    );
  });

  test("AC#4: handles DID_CHANGE_RENEWAL_STATUS AUTO_RENEW_ENABLED — no change when already subscribed", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_CHANGE_RENEWAL_STATUS",
        subtype: "AUTO_RENEW_ENABLED",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    // Default mock already returns status: "subscribed"
    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.getSubscription).toHaveBeenCalledWith("user-123");
    // Should NOT update status when already subscribed
    expect(mockSubscriptionManager.updateStatus).not.toHaveBeenCalled();
  });

  test("AC#4: handles DID_CHANGE_RENEWAL_STATUS with no existing subscription", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_CHANGE_RENEWAL_STATUS",
        subtype: "AUTO_RENEW_DISABLED",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    mockSubscriptionManager.getSubscription.mockImplementation(() =>
      Promise.resolve(undefined),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(true);
  });

  test("AC#5: handles EXPIRED notification (subscription period ended)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "EXPIRED",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "expired",
    );
  });

  test("AC#6: handles DID_FAIL_TO_RENEW with GRACE_PERIOD subtype (transitions to grace_period)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_FAIL_TO_RENEW",
        subtype: "GRACE_PERIOD",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "grace_period",
    );
  });

  test("AC#6: handles DID_FAIL_TO_RENEW without GRACE_PERIOD subtype (does not change status)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "DID_FAIL_TO_RENEW",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  test("AC#6: handles GRACE_PERIOD_EXPIRED notification", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "GRACE_PERIOD_EXPIRED",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "expired",
    );
  });

  test("handles REFUND notification (revokes access)", async () => {
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
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "expired",
    );
  });

  test("handles REVOKE notification (revokes access)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "REVOKE",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(mockSubscriptionManager.updateStatus).toHaveBeenCalledWith(
      "user-123",
      "expired",
    );
  });

  test("handles missing transaction data gracefully", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "SUBSCRIBED",
        subtype: "INITIAL_BUY",
        data: undefined,
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(true);
  });

  test("handles missing appAccountToken gracefully", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "SUBSCRIBED",
        subtype: "INITIAL_BUY",
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    mockVerifier.verifyAndDecodeTransaction.mockImplementation(() =>
      Promise.resolve({
        transactionId: "txn-1",
        originalTransactionId: "orig-txn-1",
        productId: "com.wearbloom.weekly",
        expiresDate: Date.now() + 7 * 86400000,
        // appAccountToken: deliberately missing
      } as Record<string, unknown>),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true, skipped: true });
  });

  test("handles unknown notification type gracefully", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "UNKNOWN_FUTURE_TYPE",
        subtype: undefined,
        data: {
          signedTransactionInfo: "signed-txn-info",
        },
      }),
    );

    const result = await handler.handleNotification("signed-payload");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ received: true });
    // Verify handler logged the unhandled notification type
    expect(mockLogger.info.mock.calls.length).toBeGreaterThan(0);
  });
});
