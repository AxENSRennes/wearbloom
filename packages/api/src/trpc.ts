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
    options?: { category?: string; mode?: string },
  ): Promise<{ jobId: string }>;
  getResult(
    jobId: string,
  ): Promise<{
    imageUrl: string;
    imageData?: Buffer;
    contentType: string;
  } | null>;
  readonly name: string;
}

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: AuthInstance;
  imageStorage?: ImageStorage;
  backgroundRemoval?: BackgroundRemoval;
  tryOnProvider?: TryOnProviderContext;
}) => {
  const session = await opts.auth.api.getSession({ headers: opts.headers });
  return {
    db,
    session,
    auth: opts.auth,
    headers: opts.headers,
    imageStorage: opts.imageStorage,
    backgroundRemoval: opts.backgroundRemoval,
    tryOnProvider: opts.tryOnProvider,
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
