import { describe, expect, mock, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import type { AppleIapDeps, AuthInstance } from "../trpc";
import { createTRPCContext } from "../trpc";

const TEST_USER_ID = "user-credit-test";

const mockSession = {
  user: { id: TEST_USER_ID, name: "Credit User", email: "credit@example.com" },
  session: {
    id: "sess-credit",
    token: "tok-credit",
    expiresAt: new Date("2030-01-01"),
    createdAt: new Date("2024-01-01"),
    userId: TEST_USER_ID,
  },
};

function createMockAuth(
  session: typeof mockSession | null,
): AuthInstance {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
      signOut: mock(() => Promise.resolve()),
    },
  };
}

function createMockAppleIap(
  overrides?: {
    verifier?: Partial<AppleIapDeps["verifier"]>;
    client?: Partial<AppleIapDeps["client"]>;
  },
): AppleIapDeps {
  return {
    verifier: {
      verifyAndDecodeNotification: mock(() => Promise.resolve({})),
      verifyAndDecodeTransaction: mock(
        () =>
          Promise.resolve({
            originalTransactionId: "orig-txn-test",
            transactionId: "txn-test",
            productId: "com.wearbloom.weekly",
            expiresDate: Date.now() + 7 * 86400000,
            appAccountToken: TEST_USER_ID,
            purchaseDate: Date.now(),
          }) as Promise<Record<string, unknown>>,
      ),
      ...overrides?.verifier,
    },
    client: {
      requestTestNotification: mock(() =>
        Promise.resolve({ testNotificationToken: "test" }),
      ),
      ...overrides?.client,
    },
  };
}

async function createAuthenticatedCaller(appleIap?: AppleIapDeps) {
  const { appRouter } = await import("../root");
  const auth = createMockAuth(mockSession);
  const ctx = await createTRPCContext({
    headers: new Headers({ cookie: "session=xyz" }),
    auth,
    freeCreditsCount: 3,
    appleIap,
  });
  return appRouter.createCaller(ctx);
}

async function createUnauthenticatedCaller() {
  const { appRouter } = await import("../root");
  const auth = createMockAuth(null);
  const ctx = await createTRPCContext({
    headers: new Headers(),
    auth,
    freeCreditsCount: 3,
  });
  return appRouter.createCaller(ctx);
}

describe("subscription.getCredits", () => {
  test("returns zeros for user with no credits row", async () => {
    const caller = await createAuthenticatedCaller();
    const result = await caller.subscription.getCredits();

    expect(result.totalGranted).toBe(0);
    expect(result.totalConsumed).toBe(0);
    expect(result.remaining).toBe(0);
  });

  test("throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = await createUnauthenticatedCaller();

    expect(caller.subscription.getCredits()).rejects.toThrow(TRPCError);
  });
});

describe("subscription.grantInitialCredits", () => {
  test("grants configured free credits count", async () => {
    const caller = await createAuthenticatedCaller();
    const result = await caller.subscription.grantInitialCredits();

    expect(result.totalGranted).toBe(3);
    expect(result.totalConsumed).toBe(0);
    expect(result.remaining).toBe(3);
  });

  test("is idempotent — second call does not change credits", async () => {
    const caller = await createAuthenticatedCaller();

    await caller.subscription.grantInitialCredits();
    const result = await caller.subscription.grantInitialCredits();

    expect(result.totalGranted).toBe(3);
    expect(result.remaining).toBe(3);
  });
});

describe("subscription.getSubscriptionStatus", () => {
  test("returns free_with_credits when user has credits", async () => {
    const caller = await createAuthenticatedCaller();

    await caller.subscription.grantInitialCredits();
    const status = await caller.subscription.getSubscriptionStatus();

    expect(status.isSubscriber).toBe(false);
    expect(status.creditsRemaining).toBe(3);
    expect(status.state).toBe("free_with_credits");
    expect(status.canRender).toBe(true);
  });

  test("returns free_no_credits when user has no credits", async () => {
    const caller = await createAuthenticatedCaller();
    const status = await caller.subscription.getSubscriptionStatus();

    expect(status.isSubscriber).toBe(false);
    expect(status.creditsRemaining).toBe(0);
    expect(status.state).toBe("free_no_credits");
    expect(status.canRender).toBe(false);
  });

  test("returns subscriber status when user has active subscription", async () => {
    const { db } = await import("@acme/db/client");
    const { subscriptions } = await import("@acme/db/schema");
    await db.insert(subscriptions).values({
      userId: TEST_USER_ID,
      status: "subscribed",
      appleTransactionId: "txn-status-1",
      appleOriginalTransactionId: "orig-txn-status-1",
      productId: "com.wearbloom.weekly",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    const caller = await createAuthenticatedCaller();
    const status = await caller.subscription.getSubscriptionStatus();

    expect(status.isSubscriber).toBe(true);
    expect(status.state).toBe("subscribed");
    expect(status.canRender).toBe(true);
  });

  test("returns no_subscription with subscription fields for user without subscription", async () => {
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const { subscriptions } = await import("@acme/db/schema");
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));

    const caller = await createAuthenticatedCaller();
    const result = await caller.subscription.getSubscriptionStatus();

    expect(result.state).toBe("free_no_credits");
    expect(result.isSubscriber).toBe(false);
    expect(result.rendersAllowed).toBe(false);
    expect(result.isUnlimited).toBe(false);
    expect(result.hadSubscription).toBe(false);
  });

  test("returns trial status with full fields for trial subscription", async () => {
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const { subscriptions } = await import("@acme/db/schema");
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));
    await db.insert(subscriptions).values({
      userId: TEST_USER_ID,
      status: "trial",
      appleTransactionId: "txn-trial",
      appleOriginalTransactionId: "orig-txn-trial",
      productId: "com.wearbloom.weekly",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });

    const caller = await createAuthenticatedCaller();
    const result = await caller.subscription.getSubscriptionStatus();

    expect(result.state).toBe("trial");
    expect(result.isSubscriber).toBe(true);
    expect(result.rendersAllowed).toBe(true);
    expect(result.isUnlimited).toBe(true);
    expect(result.expiresAt).toBeDefined();
    expect(result.hadSubscription).toBe(true);
  });

  test("returns expired with full fields for expired subscription", async () => {
    const { db } = await import("@acme/db/client");
    const { eq } = await import("@acme/db");
    const { subscriptions } = await import("@acme/db/schema");
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, TEST_USER_ID));
    await db.insert(subscriptions).values({
      userId: TEST_USER_ID,
      status: "subscribed",
      appleTransactionId: "txn-expired",
      appleOriginalTransactionId: "orig-txn-expired",
      productId: "com.wearbloom.weekly",
      startedAt: new Date(Date.now() - 14 * 86400000),
      expiresAt: new Date(Date.now() - 86400000),
    });

    const caller = await createAuthenticatedCaller();
    const result = await caller.subscription.getSubscriptionStatus();

    expect(result.state).toBe("expired");
    expect(result.isSubscriber).toBe(false);
    expect(result.rendersAllowed).toBe(false);
    expect(result.hadSubscription).toBe(true);
  });
});

describe("subscription.verifyPurchase", () => {
  test("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = await createUnauthenticatedCaller();
    await expect(
      caller.subscription.verifyPurchase({
        signedTransactionInfo: "fake-jws",
      }),
    ).rejects.toThrow(TRPCError);
  });

  test("throws when Apple IAP is not configured", async () => {
    const caller = await createAuthenticatedCaller(); // no appleIap
    await expect(
      caller.subscription.verifyPurchase({
        signedTransactionInfo: "fake-jws",
      }),
    ).rejects.toThrow("APPLE_IAP_NOT_CONFIGURED");
  });

  test("throws TRANSACTION_USER_MISMATCH when appAccountToken differs", async () => {
    const appleIap = createMockAppleIap({
      verifier: {
        verifyAndDecodeTransaction: mock(() =>
          Promise.resolve({
            originalTransactionId: "orig-txn-mismatch",
            transactionId: "txn-mismatch",
            productId: "com.wearbloom.weekly",
            expiresDate: Date.now() + 7 * 86400000,
            appAccountToken: "different-user-id",
            purchaseDate: Date.now(),
          }) as Promise<Record<string, unknown>>,
        ),
      },
    });
    const caller = await createAuthenticatedCaller(appleIap);
    await expect(
      caller.subscription.verifyPurchase({
        signedTransactionInfo: "valid-jws-wrong-user",
      }),
    ).rejects.toThrow("TRANSACTION_USER_MISMATCH");
  });

  test("throws MISSING_APP_ACCOUNT_TOKEN when appAccountToken is absent", async () => {
    const appleIap = createMockAppleIap({
      verifier: {
        verifyAndDecodeTransaction: mock(() =>
          Promise.resolve({
            originalTransactionId: "orig-txn-no-token",
            transactionId: "txn-no-token",
            productId: "com.wearbloom.weekly",
            expiresDate: Date.now() + 7 * 86400000,
            purchaseDate: Date.now(),
            // no appAccountToken
          }) as Promise<Record<string, unknown>>,
        ),
      },
    });
    const caller = await createAuthenticatedCaller(appleIap);
    await expect(
      caller.subscription.verifyPurchase({
        signedTransactionInfo: "valid-jws-no-token",
      }),
    ).rejects.toThrow("MISSING_APP_ACCOUNT_TOKEN");
  });

  test("creates subscription record on valid purchase", async () => {
    const appleIap = createMockAppleIap();
    const caller = await createAuthenticatedCaller(appleIap);

    const result = await caller.subscription.verifyPurchase({
      signedTransactionInfo: "valid-jws-token",
    });

    expect(result.status).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });
});

describe("subscription.restorePurchases", () => {
  test("throws UNAUTHORIZED for unauthenticated users", async () => {
    const caller = await createUnauthenticatedCaller();
    await expect(
      caller.subscription.restorePurchases({ signedTransactions: [] }),
    ).rejects.toThrow(TRPCError);
  });

  test("restores valid non-expired purchase", async () => {
    const appleIap = createMockAppleIap();
    const caller = await createAuthenticatedCaller(appleIap);

    const result = await caller.subscription.restorePurchases({
      signedTransactions: ["valid-signed-txn"],
    });

    expect(result.restored).toBe(1);
  });

  test("returns empty result when no transactions provided", async () => {
    const appleIap = createMockAppleIap();
    const caller = await createAuthenticatedCaller(appleIap);

    const result = await caller.subscription.restorePurchases({
      signedTransactions: [],
    });

    expect(result.restored).toBe(0);
  });

  test("skips transactions with missing appAccountToken", async () => {
    const appleIap = createMockAppleIap({
      verifier: {
        verifyAndDecodeTransaction: mock(() =>
          Promise.resolve({
            originalTransactionId: "orig-txn-no-token",
            transactionId: "txn-no-token",
            productId: "com.wearbloom.weekly",
            expiresDate: Date.now() + 7 * 86400000,
            purchaseDate: Date.now(),
            // no appAccountToken — must be skipped to prevent cross-user theft
          }) as Promise<Record<string, unknown>>,
        ),
      },
    });
    const caller = await createAuthenticatedCaller(appleIap);

    const result = await caller.subscription.restorePurchases({
      signedTransactions: ["signed-txn-no-token"],
    });

    expect(result.restored).toBe(0);
  });

  test("skips transactions with mismatched appAccountToken", async () => {
    const appleIap = createMockAppleIap({
      verifier: {
        verifyAndDecodeTransaction: mock(() =>
          Promise.resolve({
            originalTransactionId: "orig-txn-other",
            transactionId: "txn-other",
            productId: "com.wearbloom.weekly",
            expiresDate: Date.now() + 7 * 86400000,
            purchaseDate: Date.now(),
            appAccountToken: "different-user-id",
          }) as Promise<Record<string, unknown>>,
        ),
      },
    });
    const caller = await createAuthenticatedCaller(appleIap);

    const result = await caller.subscription.restorePurchases({
      signedTransactions: ["signed-txn-other-user"],
    });

    expect(result.restored).toBe(0);
  });
});
