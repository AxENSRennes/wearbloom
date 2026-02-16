import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import { db } from "@acme/db/client";

export interface AuthInstance {
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      user: {
        id: string;
        name: string | null;
        email: string;
        isAnonymous?: boolean | null;
      };
      session: {
        id: string;
        token: string;
        expiresAt: Date;
        createdAt: Date;
        userId: string;
      };
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

export interface AnonymousConfig {
  sessionTtlHours: number;
  maxRenders: number;
}

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: AuthInstance;
  freeCreditsCount?: number;
  appleIap?: AppleIapDeps;
  anonymousConfig?: AnonymousConfig;
}) => {
  const session = await opts.auth.api.getSession({ headers: opts.headers });
  return {
    db,
    session,
    auth: opts.auth,
    headers: opts.headers,
    freeCreditsCount: opts.freeCreditsCount ?? 3,
    appleIap: opts.appleIap,
    anonymousConfig: opts.anonymousConfig,
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
  if (ctx.session.user.isAnonymous) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "ACCOUNT_REQUIRED",
    });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

const enforceEphemeralLimits = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (ctx.session.user.isAnonymous) {
    const ttlHours = ctx.anonymousConfig?.sessionTtlHours ?? 24;
    const ttlMs = ttlHours * 60 * 60 * 1000;
    const sessionAge =
      Date.now() - new Date(ctx.session.session.createdAt).getTime();

    if (sessionAge > ttlMs) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "ANONYMOUS_SESSION_EXPIRED",
      });
    }

    // TODO: Enable when renders table exists (Story 3.2)
    // Check render usage:
    // const existingRenders = await ctx.db.select().from(renders).where(eq(renders.userId, ctx.session.user.id));
    // const maxRenders = ctx.anonymousConfig?.maxRenders ?? 1;
    // if (existingRenders.length >= maxRenders) {
    //   throw new TRPCError({ code: "FORBIDDEN", message: "ANONYMOUS_LIMIT_REACHED" });
    // }
  }

  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

export const ephemeralProcedure = t.procedure.use(enforceEphemeralLimits);
