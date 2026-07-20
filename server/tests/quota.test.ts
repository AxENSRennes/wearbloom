import { describe, expect, test } from "bun:test";
import { allowanceFor, canGenerate, quotaPeriod } from "../src/domain/quota";

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
});
