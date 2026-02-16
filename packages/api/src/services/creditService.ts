import type { db as DbInstance } from "@acme/db/client";
import { and, eq, lt, sql } from "@acme/db";
import { credits } from "@acme/db/schema";

export function createCreditService({ db }: { db: typeof DbInstance }) {
  return {
    async grantFreeCredits(userId: string, count: number): Promise<void> {
      await db
        .insert(credits)
        .values({
          userId,
          totalGranted: count,
          totalConsumed: 0,
        })
        .onConflictDoNothing();
    },

    async consumeCredit(
      userId: string,
    ): Promise<{ success: boolean; remaining: number }> {
      const result = await db
        .update(credits)
        .set({ totalConsumed: sql`${credits.totalConsumed} + 1` })
        .where(
          and(
            eq(credits.userId, userId),
            lt(credits.totalConsumed, credits.totalGranted),
          ),
        )
        .returning({
          totalConsumed: credits.totalConsumed,
          totalGranted: credits.totalGranted,
        });

      const row = result[0];
      if (!row) {
        return { success: false, remaining: 0 };
      }

      return { success: true, remaining: row.totalGranted - row.totalConsumed };
    },

    async refundCredit(userId: string): Promise<void> {
      await db
        .update(credits)
        .set({ totalConsumed: sql`GREATEST(${credits.totalConsumed} - 1, 0)` })
        .where(eq(credits.userId, userId));
    },

    async getCreditBalance(userId: string): Promise<{
      totalGranted: number;
      totalConsumed: number;
      remaining: number;
    }> {
      const rows = await db
        .select({
          totalGranted: credits.totalGranted,
          totalConsumed: credits.totalConsumed,
        })
        .from(credits)
        .where(eq(credits.userId, userId));

      const row = rows[0];
      if (!row) {
        return { totalGranted: 0, totalConsumed: 0, remaining: 0 };
      }

      return {
        totalGranted: row.totalGranted,
        totalConsumed: row.totalConsumed,
        remaining: row.totalGranted - row.totalConsumed,
      };
    },

    async hasCreditsRemaining(userId: string): Promise<boolean> {
      const { remaining } = await this.getCreditBalance(userId);
      return remaining > 0;
    },
  };
}
