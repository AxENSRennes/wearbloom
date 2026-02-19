import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod/v4";

import type {
  GarmentCategory,
  RenderMode,
  TryOnProviderName,
} from "@acme/validators";
import { db } from "@acme/db/client";

import { RateLimiter } from "./rateLimit";

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
    verifyAndDecodeNotification: (signedPayload: string) => Promise<{
      notificationType?: string;
      subtype?: string;
      data?: unknown;
    }>;
    verifyAndDecodeTransaction: (signedTransaction: string) => Promise<unknown>;
  };
  client: {
    requestTestNotification: () => Promise<unknown>;
  };
}

export interface ImageStorage {
  saveBodyPhoto(
    userId: string,
    fileData: Buffer,
    mimeType: string,
  ): Promise<string>;
  deleteBodyPhoto(userId: string, filePath: string): Promise<void>;
  deleteUserDirectory(userId: string): Promise<void>;
  getAbsolutePath(filePath: string): string;
  streamFile(filePath: string): ReadableStream;
  saveGarmentPhoto(
    userId: string,
    fileData: Buffer,
    mimeType: string,
    garmentId: string,
  ): Promise<string>;
  saveCutoutPhoto(
    userId: string,
    fileData: Buffer,
    garmentId: string,
  ): Promise<string>;
  deleteGarmentFiles(userId: string, garmentId: string): Promise<void>;
  saveRenderResult(
    userId: string,
    renderId: string,
    imageData: Buffer,
    mimeType: string,
  ): Promise<string>;
}

export interface BackgroundRemoval {
  removeBackground(imageBuffer: Buffer): Promise<Buffer | null>;
}

export interface TryOnProviderContext {
  submitRender(
    personImage: string | Buffer,
    garmentImage: string | Buffer,
    options?: { category?: GarmentCategory; mode?: RenderMode },
  ): Promise<{ jobId: string }>;
  getResult(jobId: string): Promise<{
    imageUrl: string;
    imageData?: Buffer;
    contentType: string;
  } | null>;
  readonly name: TryOnProviderName;
  readonly supportedCategories: readonly GarmentCategory[];
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
  imageStorage?: ImageStorage;
  backgroundRemoval?: BackgroundRemoval;
  tryOnProvider?: TryOnProviderContext;
  renderTimeoutMs?: number;
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
    imageStorage: opts.imageStorage,
    backgroundRemoval: opts.backgroundRemoval,
    tryOnProvider: opts.tryOnProvider,
    renderTimeoutMs: opts.renderTimeoutMs,
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

// ---------------------------------------------------------------------------
// Rate-limited procedures (audit S10-1)
// ---------------------------------------------------------------------------
export const renderLimiter = new RateLimiter(10, 60_000); // 10 req/min per user
export const uploadLimiter = new RateLimiter(20, 60_000); // 20 req/min per user

/** For AI render requests — most expensive operation. */
export const renderProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!renderLimiter.check(ctx.session.user.id)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "RATE_LIMIT_EXCEEDED",
    });
  }
  return next();
});

/** For file uploads (garment photos, body photos). */
export const uploadProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!uploadLimiter.check(ctx.session.user.id)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "RATE_LIMIT_EXCEEDED",
    });
  }
  return next();
});
