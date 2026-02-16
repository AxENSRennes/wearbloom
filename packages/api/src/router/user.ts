import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { bodyPhotos, users } from "@acme/db/schema";

import { protectedProcedure, uploadProcedure } from "../trpc";
import { validateImageBytes } from "../validateImageBytes";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const userRouter = {
  uploadBodyPhoto: uploadProcedure
    .input(z.instanceof(FormData))
    .mutation(async ({ ctx, input }) => {
      // Cast needed: RN FormData typings lack .get(), but server runtime (Bun) has it
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

      const widthStr = formData.get("width");
      const heightStr = formData.get("height");
      const width =
        typeof widthStr === "string" ? Number(widthStr) : undefined;
      const height =
        typeof heightStr === "string" ? Number(heightStr) : undefined;

      const validTypes = ["image/jpeg", "image/png"];
      if (!validTypes.includes(file.type)) {
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

      // Delete existing body photo if any (upsert pattern)
      const existing = await ctx.db
        .select()
        .from(bodyPhotos)
        .where(eq(bodyPhotos.userId, userId))
        .limit(1);

      const existingPhoto = existing[0];
      if (existingPhoto) {
        await ctx.imageStorage.deleteBodyPhoto(userId, existingPhoto.filePath);
        await ctx.db
          .delete(bodyPhotos)
          .where(eq(bodyPhotos.id, existingPhoto.id));
      }

      // Save new photo
      const filePath = await ctx.imageStorage.saveBodyPhoto(
        userId,
        buffer,
        file.type,
      );

      const [newRecord] = await ctx.db
        .insert(bodyPhotos)
        .values({
          userId,
          filePath,
          mimeType: file.type,
          fileSize: file.size,
          width: width || undefined,
          height: height || undefined,
        })
        .returning({ id: bodyPhotos.id });

      if (!newRecord) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "RECORD_INSERT_FAILED",
        });
      }
      return { imageId: newRecord.id };
    }),

  getBodyPhoto: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const result = await ctx.db
      .select({ id: bodyPhotos.id })
      .from(bodyPhotos)
      .where(eq(bodyPhotos.userId, userId))
      .limit(1);

    const photo = result[0];
    if (!photo) return null;

    return {
      imageId: photo.id,
      imageUrl: `/api/images/${photo.id}`,
    };
  }),
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    if (!ctx.imageStorage) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "IMAGE_STORAGE_NOT_CONFIGURED",
      });
    }

    try {
      // Filesystem first — remove entire user directory
      await ctx.imageStorage.deleteUserDirectory(userId);

      // DB second — cascade handles sessions, accounts, bodyPhotos
      await ctx.db.delete(users).where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "ACCOUNT_DELETION_FAILED",
        cause: error,
      });
    }
  }),
} satisfies TRPCRouterRecord;
