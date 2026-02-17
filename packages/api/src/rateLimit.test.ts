import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { RateLimiter } from "./rateLimit";

describe("RateLimiter", () => {
  afterEach(() => {
    setSystemTime();
  });

  test("allows requests under the limit", () => {
    const limiter = new RateLimiter(3, 60_000);

    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
  });

  test("blocks requests that exceed the limit", () => {
    const limiter = new RateLimiter(2, 60_000);

    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);
  });

  test("allows requests after window expires", () => {
    const limiter = new RateLimiter(1, 1_000);

    const baseTime = Date.now();
    setSystemTime(new Date(baseTime));

    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);

    setSystemTime(new Date(baseTime + 1_001));

    expect(limiter.check("user-1")).toBe(true);
  });

  test("tracks keys independently", () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-2")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);
    expect(limiter.check("user-2")).toBe(false);
  });

  test("reset clears all tracked state", () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.check("user-1")).toBe(true);
    expect(limiter.check("user-1")).toBe(false);

    limiter.reset();

    expect(limiter.check("user-1")).toBe(true);
  });

  test("sliding window prunes old timestamps on each check", () => {
    const limiter = new RateLimiter(2, 1_000);

    const baseTime = Date.now();
    setSystemTime(new Date(baseTime));

    expect(limiter.check("user-1")).toBe(true);

    setSystemTime(new Date(baseTime + 500));
    expect(limiter.check("user-1")).toBe(true);

    // Both timestamps are within the window — next should be blocked
    expect(limiter.check("user-1")).toBe(false);

    // Advance past the first timestamp's expiry but not the second's
    setSystemTime(new Date(baseTime + 1_001));

    // First timestamp pruned, only second remains — should allow
    expect(limiter.check("user-1")).toBe(true);
  });
});
