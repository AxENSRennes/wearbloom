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

  test("AC#3: handles RENEWAL INITIAL_BUY notification (subscription created)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "RENEWAL",
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

  test("AC#3: handles RENEWAL RESUBSCRIBE notification (user resubscribes)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "RENEWAL",
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

  test("AC#4: handles CANCEL notification (user cancelled subscription)", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "CANCEL",
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
      "cancelled",
      expect.any(Date),
    );
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

  test("AC#6: handles DID_FAIL_TO_RENEW notification (grace period active)", async () => {
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
    // Verify log was called (grace period is handled by Apple, we just log)
    expect(mockLogger.warn.mock.calls.length).toBeGreaterThan(0);
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

  test("handles missing transaction data gracefully", async () => {
    mockVerifier.verifyAndDecodeNotification.mockImplementation(() =>
      Promise.resolve({
        notificationType: "RENEWAL",
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
        notificationType: "RENEWAL",
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
