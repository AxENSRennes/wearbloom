import type { TRPCRouterRecord } from "@trpc/server";

import { and, eq } from "@acme/db";
import { tryOnRenders } from "@acme/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) return null;
    return { user: ctx.session.user };
  }),
  getEphemeralStatus: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session) {
      return { isAnonymous: false, hasUsedFreeRender: false, sessionAgeMs: 0 };
    }

    const isAnonymous = ctx.session.user.isAnonymous === true;
    const sessionAgeMs =
      Date.now() - new Date(ctx.session.session.createdAt).getTime();

    let hasUsedFreeRender = false;
    if (isAnonymous) {
      const userId = ctx.session.user.id;
      const renderResult = await ctx.db
        .select({ id: tryOnRenders.id })
        .from(tryOnRenders)
        .where(
          and(
            eq(tryOnRenders.userId, userId),
            eq(tryOnRenders.status, "completed"),
          ),
        )
        .limit(1);
      hasUsedFreeRender = renderResult.length > 0;
    }

    return { isAnonymous, hasUsedFreeRender, sessionAgeMs };
  }),
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.auth.api.signOut({ headers: ctx.headers });
    return { success: true };
  }),
} satisfies TRPCRouterRecord;
