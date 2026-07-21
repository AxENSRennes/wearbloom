import { describe, expect, test } from "bun:test";
import { rateLimitWindow } from "../src/security/rate-limit";

describe("rate limit windows", () => {
  test("uses deterministic ten-minute UTC buckets", () => {
    expect(rateLimitWindow(new Date("2026-07-20T12:19:59.999Z"), 600).toISOString()).toBe("2026-07-20T12:10:00.000Z");
  });
});
