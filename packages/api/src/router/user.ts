import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { eq } from "@acme/db";
import { bodyPhotos } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const userRouter = {
  uploadBodyPhoto: protectedProcedure
    .input(z.instanceof(FormData))
    .mutation(async ({ ctx, input }) => {
      // Cast needed: RN FormData typings lack .get(), but server runtime (Bun) has it
      const formData = input as unknown as { get(key: string): File | null };
      const file = formData.get("photo");
      if (!file) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MISSING_PHOTO",
        });
      }

      const validTypes = ["image/jpeg", "image/png"];
      if (!validTypes.includes(file.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "IMAGE_TOO_LARGE",
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
        })
        .returning({ id: bodyPhotos.id });

      return { imageId: newRecord!.id };
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
} satisfies TRPCRouterRecord;
