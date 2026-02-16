import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) return null;
    return { user: ctx.session.user };
  }),
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.auth.api.signOut({ headers: ctx.headers });
    return { success: true };
  }),
} satisfies TRPCRouterRecord;
