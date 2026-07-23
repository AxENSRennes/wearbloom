import { and, eq, gt, sql } from "drizzle-orm";
import type { AppConfig } from "../config";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import { allowanceFor, quotaPeriod } from "./quota";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type QuotaReader = Pick<Transaction, "select">;
type QuotaLocker = Pick<Transaction, "execute">;
type QuotaLimits = Pick<AppConfig, "FREE_RENDER_ALLOWANCE" | "PAID_MONTHLY_ALLOWANCE">;

export type QuotaSnapshot = {
  isPro: boolean;
  allowance: number;
  paidAllowance: number;
  used: number;
  remaining: number;
  periodKey: string;
};

export async function lockOwnerQuota(database: QuotaLocker, ownerId: string): Promise<void> {
  await database.execute(sql`select pg_advisory_xact_lock(hashtext(${ownerId}))`);
}

export async function getQuotaSnapshot(
  database: QuotaReader,
  ownerId: string,
  now: Date,
  limits: QuotaLimits,
): Promise<QuotaSnapshot> {
  const [entitlement] = await database
    .select({ ownerId: schema.entitlements.ownerId })
    .from(schema.entitlements)
    .where(
      and(
        eq(schema.entitlements.ownerId, ownerId),
        eq(schema.entitlements.isPro, true),
        gt(schema.entitlements.expiresAt, now),
      ),
    )
    .limit(1);
  const isPro = Boolean(entitlement);
  const periodKey = isPro ? quotaPeriod(now) : "free-lifetime";
  const allowance = allowanceFor({
    isPro,
    freeAllowance: limits.FREE_RENDER_ALLOWANCE,
    paidAllowance: limits.PAID_MONTHLY_ALLOWANCE,
  });
  const [usage] = await database
    .select({ units: sql<number>`coalesce(sum(${schema.quotaLedger.units}), 0)::int` })
    .from(schema.quotaLedger)
    .where(and(eq(schema.quotaLedger.ownerId, ownerId), eq(schema.quotaLedger.periodKey, periodKey)));
  const used = usage?.units ?? 0;
  return {
    isPro,
    allowance,
    paidAllowance: limits.PAID_MONTHLY_ALLOWANCE,
    used,
    remaining: Math.max(0, allowance - used),
    periodKey,
  };
}
