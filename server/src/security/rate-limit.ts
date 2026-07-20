import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import * as schema from "../db/schema";

export class RateLimitError extends Error {}

export class RateLimiter {
  constructor(private readonly db: Database) {}

  async check(ownerId: string, action: string, limit: number, windowSeconds = 600): Promise<number> {
    const start = rateLimitWindow(new Date(), windowSeconds);
    const [row] = await this.db.insert(schema.rateLimitWindows).values({
      ownerId,
      action,
      windowStart: start,
      count: 1,
    }).onConflictDoUpdate({
      target: [schema.rateLimitWindows.ownerId, schema.rateLimitWindows.action, schema.rateLimitWindows.windowStart],
      set: { count: sql`${schema.rateLimitWindows.count} + 1` },
    }).returning({ count: schema.rateLimitWindows.count });
    const count = row?.count ?? limit + 1;
    if (count > limit) throw new RateLimitError("RATE_LIMITED");
    return Math.max(0, limit - count);
  }
}

export function rateLimitWindow(now: Date, windowSeconds: number): Date {
  const windowMilliseconds = windowSeconds * 1_000;
  return new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
}
