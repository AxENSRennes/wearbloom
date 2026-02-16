import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { createSubscriptionManager } from "./subscriptionManager";

describe("subscriptionManager", () => {
  // Mock db with Drizzle-like API
  const mockReturning = mock(() => Promise.resolve([]));
  const mockWhere = mock(() => ({ returning: mockReturning }));
  const mockSet = mock(() => ({ where: mockWhere }));
  const mockValues = mock(() => ({
    onConflictDoUpdate: mock(() => ({ returning: mockReturning })),
    returning: mockReturning,
  }));
  const mockInsert = mock(() => ({ values: mockValues }));
  const mockUpdate = mock(() => ({ set: mockSet }));
  const mockSelectFrom = mock(() => ({ where: mock(() => Promise.resolve([])) }));
  const mockSelect = mock(() => ({ from: mockSelectFrom }));

  const mockDb = {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  };

  let manager: ReturnType<typeof createSubscriptionManager>;

  beforeEach(() => {
    mock.restore();
    manager = createSubscriptionManager({
      db: mockDb as unknown as Parameters<typeof createSubscriptionManager>[0]["db"],
    });
  });

  afterEach(() => {
    mock.restore();
  });

  describe("computeSubscriptionState", () => {
    test("returns trial when subscription status is trial and not expired", () => {
      const state = manager.computeSubscriptionState({
        status: "trial",
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
      });
      expect(state).toEqual({
        state: "trial",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      });
    });

    test("returns subscribed when subscription status is subscribed and not expired", () => {
      const state = manager.computeSubscriptionState({
        status: "subscribed",
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(state).toEqual({
        state: "subscribed",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      });
    });

    test("returns expired when subscription has passed expiresAt", () => {
      const state = manager.computeSubscriptionState({
        status: "subscribed",
        expiresAt: new Date(Date.now() - 86400000), // yesterday
      });
      expect(state).toEqual({
        state: "expired",
        isSubscriber: false,
        rendersAllowed: false,
        isUnlimited: false,
      });
    });

    test("returns expired when status is expired", () => {
      const state = manager.computeSubscriptionState({
        status: "expired",
        expiresAt: new Date(Date.now() - 86400000),
      });
      expect(state).toEqual({
        state: "expired",
        isSubscriber: false,
        rendersAllowed: false,
        isUnlimited: false,
      });
    });

    test("returns cancelled but still active until expiry", () => {
      const state = manager.computeSubscriptionState({
        status: "cancelled",
        expiresAt: new Date(Date.now() + 86400000),
      });
      // Cancelled but not yet expired — still has access
      expect(state).toEqual({
        state: "cancelled",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      });
    });

    test("returns expired when cancelled and past expiry", () => {
      const state = manager.computeSubscriptionState({
        status: "cancelled",
        expiresAt: new Date(Date.now() - 86400000),
      });
      expect(state).toEqual({
        state: "expired",
        isSubscriber: false,
        rendersAllowed: false,
        isUnlimited: false,
      });
    });

    test("returns grace_period with active access during billing retry", () => {
      const state = manager.computeSubscriptionState({
        status: "grace_period",
        expiresAt: new Date(Date.now() + 86400000),
      });
      expect(state).toEqual({
        state: "grace_period",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      });
    });

    test("returns grace_period with active access even if expiresAt passed", () => {
      const state = manager.computeSubscriptionState({
        status: "grace_period",
        expiresAt: new Date(Date.now() - 86400000),
      });
      // Grace period overrides time-based expiration — Apple controls the grace window
      expect(state).toEqual({
        state: "grace_period",
        isSubscriber: true,
        rendersAllowed: true,
        isUnlimited: true,
      });
    });

    test("returns no_subscription when no subscription exists", () => {
      const state = manager.computeSubscriptionState(null);
      expect(state).toEqual({
        state: "no_subscription",
        isSubscriber: false,
        rendersAllowed: false,
        isUnlimited: false,
      });
    });
  });

  describe("determineSubscriptionStatus", () => {
    test("returns trial for initial buy with trial", () => {
      const status = manager.determineSubscriptionStatus({
        isInitialBuy: true,
        hasTrial: true,
      });
      expect(status).toBe("trial");
    });

    test("returns subscribed for initial buy without trial", () => {
      const status = manager.determineSubscriptionStatus({
        isInitialBuy: true,
        hasTrial: false,
      });
      expect(status).toBe("subscribed");
    });

    test("returns subscribed for resubscribe", () => {
      const status = manager.determineSubscriptionStatus({
        isInitialBuy: false,
        hasTrial: false,
      });
      expect(status).toBe("subscribed");
    });
  });
});
