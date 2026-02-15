import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.auth.api.signOut({ headers: ctx.headers });
    return { success: true };
  }),
} satisfies TRPCRouterRecord;
