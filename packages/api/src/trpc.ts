import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import { db } from "@acme/db/client";

export interface AuthInstance {
  api: {
    getSession: (opts: {
      headers: Headers;
    }) => Promise<{
      user: { id: string; name: string | null; email: string };
      session: { id: string; token: string; expiresAt: Date; userId: string };
    } | null>;
    signOut: (opts: { headers: Headers }) => Promise<unknown>;
  };
}

export interface AppleIapDeps {
  verifier: {
    verifyAndDecodeNotification: (
      signedPayload: string,
    ) => Promise<{ notificationType?: string; subtype?: string; data?: unknown }>;
    verifyAndDecodeTransaction: (
      signedTransaction: string,
    ) => Promise<Record<string, unknown>>;
  };
  client: {
    requestTestNotification: () => Promise<unknown>;
  };
}

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: AuthInstance;
  freeCreditsCount?: number;
  appleIap?: AppleIapDeps;
}) => {
  const session = await opts.auth.api.getSession({ headers: opts.headers });
  return {
    db,
    session,
    auth: opts.auth,
    headers: opts.headers,
    freeCreditsCount: opts.freeCreditsCount ?? 3,
    appleIap: opts.appleIap,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.format() : null,
    },
  }),
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});
