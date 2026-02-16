import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, eq } from "@acme/db";
import { bodyPhotos, garments, tryOnRenders } from "@acme/db/schema";

import { protectedProcedure } from "../trpc";

export const tryonRouter = {
  requestRender: protectedProcedure
    .input(z.object({ garmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      if (!ctx.tryOnProvider) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "TRYON_PROVIDER_NOT_CONFIGURED",
        });
      }

      if (!ctx.imageStorage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "IMAGE_STORAGE_NOT_CONFIGURED",
        });
      }

      // Validate user has a body photo
      const bodyPhotoResult = await ctx.db
        .select({ id: bodyPhotos.id, filePath: bodyPhotos.filePath })
        .from(bodyPhotos)
        .where(eq(bodyPhotos.userId, userId))
        .limit(1);

      const bodyPhoto = bodyPhotoResult[0];
      if (!bodyPhoto) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "NO_BODY_PHOTO",
        });
      }

      // Validate garment exists and belongs to user
      const garmentResult = await ctx.db
        .select({
          id: garments.id,
          imagePath: garments.imagePath,
          cutoutPath: garments.cutoutPath,
          category: garments.category,
        })
        .from(garments)
        .where(and(eq(garments.id, input.garmentId), eq(garments.userId, userId)))
        .limit(1);

      const garment = garmentResult[0];
      if (!garment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GARMENT_NOT_FOUND",
        });
      }

      // Create render record
      const [renderRecord] = await ctx.db
        .insert(tryOnRenders)
        .values({
          userId,
          garmentId: input.garmentId,
          provider: ctx.tryOnProvider.name as "fal_fashn" | "fal_nano_banana" | "google_vto",
          status: "pending",
        })
        .returning({ id: tryOnRenders.id });

      if (!renderRecord) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "RENDER_RECORD_FAILED",
        });
      }

      // Get image paths
      const personImagePath = ctx.imageStorage.getAbsolutePath(bodyPhoto.filePath);
      const garmentImagePath = ctx.imageStorage.getAbsolutePath(
        garment.cutoutPath ?? garment.imagePath,
      );

      // Call provider
      try {
        const { jobId } = await ctx.tryOnProvider.submitRender(
          personImagePath,
          garmentImagePath,
          { category: garment.category },
        );

        await ctx.db
          .update(tryOnRenders)
          .set({ jobId, status: "processing" })
          .where(eq(tryOnRenders.id, renderRecord.id));

        return { renderId: renderRecord.id };
      } catch (error) {
        await ctx.db
          .update(tryOnRenders)
          .set({ status: "failed", errorCode: "RENDER_FAILED" })
          .where(eq(tryOnRenders.id, renderRecord.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "RENDER_FAILED",
        });
      }
    }),

  getRenderStatus: protectedProcedure
    .input(z.object({ renderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const renderResult = await ctx.db
        .select()
        .from(tryOnRenders)
        .where(eq(tryOnRenders.id, input.renderId))
        .limit(1);

      const render = renderResult[0];
      if (!render) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RENDER_NOT_FOUND",
        });
      }

      // Ownership check
      if (render.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RENDER_NOT_FOUND",
        });
      }

      // Timeout check
      const renderTimeoutMs = 30000;
      if (
        (render.status === "pending" || render.status === "processing") &&
        render.createdAt &&
        Date.now() - render.createdAt.getTime() > renderTimeoutMs
      ) {
        await ctx.db
          .update(tryOnRenders)
          .set({ status: "failed", errorCode: "RENDER_TIMEOUT" })
          .where(eq(tryOnRenders.id, input.renderId));

        return {
          status: "failed" as const,
          resultImageUrl: null,
          errorCode: "RENDER_TIMEOUT",
        };
      }

      return {
        status: render.status,
        resultImageUrl:
          render.status === "completed"
            ? `/api/images/render/${render.id}`
            : null,
        errorCode: render.errorCode,
      };
    }),
} satisfies TRPCRouterRecord;
