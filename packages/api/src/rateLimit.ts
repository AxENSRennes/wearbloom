/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks request timestamps per key and rejects when the count within
 * `windowMs` exceeds `maxRequests`. Suitable for single-server deployments;
 * swap for a Redis-backed implementation if the server scales horizontally.
 */
export class RateLimiter {
  private windows = new Map<string, number[]>();

  constructor(
    readonly maxRequests: number,
    readonly windowMs: number,
  ) {}

  /** Returns `true` if the request is allowed, `false` if rate-limited. */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.windows.get(key);

    if (!timestamps) {
      this.windows.set(key, [now]);
      return true;
    }

    const valid = timestamps.filter((t) => now - t < this.windowMs);

    if (valid.length >= this.maxRequests) {
      this.windows.set(key, valid);
      return false;
    }

    valid.push(now);
    this.windows.set(key, valid);
    return true;
  }

  /** Clear all tracked state (useful for tests). */
  reset(): void {
    this.windows.clear();
  }
}
