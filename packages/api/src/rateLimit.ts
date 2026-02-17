/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks request timestamps per key and rejects when the count within
 * `windowMs` exceeds `maxRequests`. Suitable for single-server deployments;
 * swap for a Redis-backed implementation if the server scales horizontally.
 */
export class RateLimiter {
  private windows = new Map<string, number[]>();
  private lastSweep = 0;
  private readonly SWEEP_INTERVAL_MS = 60_000;

  constructor(
    readonly maxRequests: number,
    readonly windowMs: number,
  ) {}

  private maybeSweep(): void {
    const now = Date.now();
    if (now - this.lastSweep < this.SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, timestamps] of this.windows) {
      if (timestamps.every((t) => now - t >= this.windowMs)) {
        this.windows.delete(key);
      }
    }
  }

  /** Returns `true` if the request is allowed, `false` if rate-limited. */
  check(key: string): boolean {
    this.maybeSweep();
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
