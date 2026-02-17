import type { TRPCRouterRecord } from "@trpc/server";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq } from "@acme/db";
import { GARMENT_CATEGORIES, garments } from "@acme/db/schema";

import { protectedProcedure, uploadProcedure } from "../trpc";
import { validateImageBytes } from "../validateImageBytes";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_MIME_TYPES = ["image/jpeg", "image/png"];
/**
 * Valid garment categories. Derived from GARMENT_CATEGORIES in schema.ts
 * to keep them in sync when the enum changes.
 */
const VALID_CATEGORIES = GARMENT_CATEGORIES;

export const garmentRouter = {
  upload: uploadProcedure
    .input(z.instanceof(FormData))
    .mutation(async ({ ctx, input }) => {
      const formData = input as unknown as {
        get(key: string): File | string | null;
      };

      const file = formData.get("photo");
      if (!file || typeof file === "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MISSING_PHOTO",
        });
      }

      const categoryStr = formData.get("category");
      if (typeof categoryStr !== "string") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MISSING_CATEGORY",
        });
      }

      const category = categoryStr as (typeof VALID_CATEGORIES)[number];
      if (!VALID_CATEGORIES.includes(category)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_CATEGORY",
        });
      }

      if (!VALID_MIME_TYPES.includes(file.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_IMAGE_TYPE",
        });
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "IMAGE_TOO_LARGE",
        });
      }

      if (!ctx.imageStorage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "IMAGE_STORAGE_NOT_CONFIGURED",
        });
      }

      const userId = ctx.session.user.id;
      const buffer = Buffer.from(await file.arrayBuffer());
      validateImageBytes(buffer, file.type);

      const widthStr = formData.get("width");
      const heightStr = formData.get("height");
      const width = typeof widthStr === "string" ? Number(widthStr) : undefined;
      const height =
        typeof heightStr === "string" ? Number(heightStr) : undefined;

      // Generate ID upfront and save file to FS first
      const garmentId = createId();
      let imagePath: string;
      try {
        imagePath = await ctx.imageStorage.saveGarmentPhoto(
          userId,
          buffer,
          file.type,
          garmentId,
        );
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GARMENT_SAVE_FAILED",
        });
      }

      // Single insert with real imagePath — no empty-string state
      try {
        await ctx.db.insert(garments).values({
          id: garmentId,
          userId,
          category,
          imagePath,
          mimeType: file.type,
          width: width ?? null,
          height: height ?? null,
          fileSize: file.size,
          bgRemovalStatus: "pending",
        });
      } catch {
        // Clean up FS file on insert failure
        try {
          await ctx.imageStorage.deleteGarmentFiles(userId, garmentId);
        } catch {
          // Swallow cleanup error
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GARMENT_SAVE_FAILED",
        });
      }

      // Fire-and-forget background removal
      if (ctx.backgroundRemoval) {
        const bgRemoval = ctx.backgroundRemoval;
        const imageStorage = ctx.imageStorage;
        void (async () => {
          try {
            const cutoutBuffer = await bgRemoval.removeBackground(buffer);
            if (cutoutBuffer) {
              const cutoutPath = await imageStorage.saveCutoutPhoto(
                userId,
                cutoutBuffer,
                garmentId,
              );
              await ctx.db
                .update(garments)
                .set({ cutoutPath, bgRemovalStatus: "completed" })
                .where(eq(garments.id, garmentId));
            } else {
              await ctx.db
                .update(garments)
                .set({ bgRemovalStatus: "failed" })
                .where(eq(garments.id, garmentId));
            }
          } catch {
            try {
              await ctx.db
                .update(garments)
                .set({ bgRemovalStatus: "failed" })
                .where(eq(garments.id, garmentId));
            } catch {
              // DB update failed — bgRemovalStatus stuck at "pending"
              // Will be visible as a permanently pending garment
            }
          }
        })();
      } else {
        // No background removal service available — skip
        await ctx.db
          .update(garments)
          .set({ bgRemovalStatus: "skipped" })
          .where(eq(garments.id, garmentId));
      }

      return { garmentId };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          category: z.enum(VALID_CATEGORIES).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const whereClause = input?.category
        ? and(
            eq(garments.userId, userId),
            eq(garments.category, input.category),
          )
        : eq(garments.userId, userId);

      const results = await ctx.db
        .select()
        .from(garments)
        .where(whereClause)
        .orderBy(desc(garments.createdAt));

      return results;
    }),

  delete: protectedProcedure
    .input(z.object({ garmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // 1. Verify garment exists and belongs to user
      const results = await ctx.db
        .select({ id: garments.id })
        .from(garments)
        .where(
          and(eq(garments.id, input.garmentId), eq(garments.userId, userId)),
        )
        .limit(1);

      const garment = results[0];
      if (!garment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GARMENT_NOT_FOUND",
        });
      }

      if (!ctx.imageStorage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "IMAGE_STORAGE_NOT_CONFIGURED",
        });
      }

      try {
        // 2. Delete filesystem first (prevent orphaned files)
        await ctx.imageStorage.deleteGarmentFiles(userId, input.garmentId);

        // 3. Delete DB record
        await ctx.db
          .delete(garments)
          .where(
            and(eq(garments.id, input.garmentId), eq(garments.userId, userId)),
          );

        return { success: true as const };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "GARMENT_DELETION_FAILED",
        });
      }
    }),

  getGarment: protectedProcedure
    .input(z.object({ garmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const results = await ctx.db
        .select()
        .from(garments)
        .where(
          and(eq(garments.id, input.garmentId), eq(garments.userId, userId)),
        )
        .limit(1);

      const garment = results[0];
      if (!garment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GARMENT_NOT_FOUND",
        });
      }

      return garment;
    }),
} satisfies TRPCRouterRecord;
