import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import { allowanceFor, canGenerate, quotaPeriod } from "../src/domain/quota";
import { lockOwnerQuota } from "../src/domain/quota-store";

describe("generation allowance", () => {
  test("uses the configured free and paid limits", () => {
    expect(allowanceFor({ isPro: false, freeAllowance: 2, paidAllowance: 20 })).toBe(2);
    expect(allowanceFor({ isPro: true, freeAllowance: 2, paidAllowance: 20 })).toBe(20);
  });

  test("stops exactly at the allowance", () => {
    expect(canGenerate({ used: 19, allowance: 20 })).toBeTrue();
    expect(canGenerate({ used: 20, allowance: 20 })).toBeFalse();
  });

  test("builds stable UTC period keys", () => {
    expect(quotaPeriod(new Date("2026-07-31T23:59:59Z"))).toBe("2026-07");
  });

  test("serializes reservations for the same owner inside the transaction", async () => {
    const calls: Array<{ query: string; params: unknown[] }> = [];
    const database = drizzle(async (query, params) => {
      calls.push({ query, params });
      return { rows: [] };
    });

    await lockOwnerQuota(database as never, "owner-a");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("pg_advisory_xact_lock");
    expect(calls[0]?.params).toContain("owner-a");
  });
});
