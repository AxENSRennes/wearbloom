import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getEphemeralStatus: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) {
      return { isAnonymous: false, hasUsedFreeRender: false, sessionAgeMs: 0 };
    }

    const isAnonymous = ctx.session.user.isAnonymous === true;
    const sessionAgeMs =
      Date.now() - new Date(ctx.session.session.createdAt).getTime();

    // TODO: Enable when renders table exists (Story 3.2)
    // Check if anonymous user has used their free render
    const hasUsedFreeRender = false;

    return { isAnonymous, hasUsedFreeRender, sessionAgeMs };
  }),
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.auth.api.signOut({ headers: ctx.headers });
    return { success: true };
  }),
} satisfies TRPCRouterRecord;
