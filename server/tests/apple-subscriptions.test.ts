import { describe, expect, test } from "bun:test";
import { AutoRenewStatus, NotificationTypeV2, Status } from "@apple/app-store-server-library";
import { stateFor } from "../src/subscriptions/apple-subscriptions";

const now = new Date("2026-07-23T12:00:00Z");
const future = new Date("2026-08-23T12:00:00Z").getTime();
const past = new Date("2026-07-22T12:00:00Z").getTime();

describe("Apple subscription state", () => {
  test("initial purchases and renewals grant access until Apple's expiration", () => {
    const state = stateFor(
      Status.ACTIVE,
      NotificationTypeV2.DID_RENEW,
      transaction({ expiresDate: future }),
      { autoRenewStatus: AutoRenewStatus.ON },
      now,
    );
    expect(state).toEqual({
      status: "active",
      isPro: true,
      expiresAt: new Date(future),
      willRenew: true,
    });
  });

  test("turning auto-renew off keeps paid access through expiration", () => {
    const state = stateFor(
      Status.ACTIVE,
      NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
      transaction({ expiresDate: future }),
      { autoRenewStatus: AutoRenewStatus.OFF },
      now,
    );
    expect(state.isPro).toBeTrue();
    expect(state.willRenew).toBeFalse();
  });

  test("billing grace period grants access only until the grace deadline", () => {
    const graceDeadline = new Date("2026-07-30T12:00:00Z").getTime();
    const state = stateFor(
      Status.BILLING_GRACE_PERIOD,
      NotificationTypeV2.DID_FAIL_TO_RENEW,
      transaction({ expiresDate: past }),
      { gracePeriodExpiresDate: graceDeadline, autoRenewStatus: AutoRenewStatus.ON },
      now,
    );
    expect(state.status).toBe("grace_period");
    expect(state.isPro).toBeTrue();
    expect(state.expiresAt).toEqual(new Date(graceDeadline));
  });

  test("billing retry without grace, expiration, and grace expiry remove access", () => {
    for (const [status, type] of [
      [Status.BILLING_RETRY, NotificationTypeV2.DID_FAIL_TO_RENEW],
      [Status.EXPIRED, NotificationTypeV2.EXPIRED],
      [Status.EXPIRED, NotificationTypeV2.GRACE_PERIOD_EXPIRED],
    ] as const) {
      expect(stateFor(status, type, transaction({ expiresDate: past }), undefined, now).isPro).toBeFalse();
    }
  });

  test("refunds and revocations remove access immediately", () => {
    for (const type of [NotificationTypeV2.REFUND, NotificationTypeV2.REVOKE]) {
      const state = stateFor(
        Status.REVOKED,
        type,
        transaction({ expiresDate: future, revocationDate: now.getTime() }),
        undefined,
        now,
      );
      expect(state.status).toBe("revoked");
      expect(state.isPro).toBeFalse();
    }
  });

  test("refund reversal restores only the active state Apple reports", () => {
    expect(
      stateFor(Status.ACTIVE, NotificationTypeV2.REFUND_REVERSED, transaction({ expiresDate: future }), undefined, now)
        .isPro,
    ).toBeTrue();
    expect(
      stateFor(Status.EXPIRED, NotificationTypeV2.REFUND_REVERSED, transaction({ expiresDate: past }), undefined, now)
        .isPro,
    ).toBeFalse();
  });

  test("informational and plan-change events preserve the status Apple reports", () => {
    const accessPreservingEvents = [
      NotificationTypeV2.SUBSCRIBED,
      NotificationTypeV2.DID_CHANGE_RENEWAL_PREF,
      NotificationTypeV2.OFFER_REDEEMED,
      NotificationTypeV2.PRICE_INCREASE,
      NotificationTypeV2.PRICE_CHANGE,
      NotificationTypeV2.REFUND_DECLINED,
      NotificationTypeV2.CONSUMPTION_REQUEST,
      NotificationTypeV2.RENEWAL_EXTENDED,
      NotificationTypeV2.RENEWAL_EXTENSION,
      NotificationTypeV2.MIGRATION,
      NotificationTypeV2.METADATA_UPDATE,
    ];
    for (const type of accessPreservingEvents) {
      const state = stateFor(Status.ACTIVE, type, transaction({ expiresDate: future }), undefined, now);
      expect(state.status).toBe("active");
      expect(state.isPro).toBeTrue();
    }
  });

  test("a stale date never grants access even if the status says active", () => {
    expect(
      stateFor(Status.ACTIVE, NotificationTypeV2.DID_RENEW, transaction({ expiresDate: past }), undefined, now).isPro,
    ).toBeFalse();
  });
});

function transaction(overrides: { expiresDate: number; revocationDate?: number }) {
  return {
    originalTransactionId: "1000000000001",
    transactionId: "1000000000002",
    productId: "monthly",
    ...overrides,
  };
}
