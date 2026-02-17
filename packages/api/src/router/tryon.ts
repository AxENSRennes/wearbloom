import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, count, eq, gt } from "@acme/db";
import {
  bodyPhotos,
  garments,
  renderFeedback,
  tryOnRenders,
} from "@acme/db/schema";

import { createCreditService } from "../services/creditService";
import { protectedProcedure, publicProcedure, renderProcedure } from "../trpc";

function is5xxError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    /\b5\d{2}\b/.test(msg) ||
    /Internal Server Error/i.test(msg) ||
    /Bad Gateway/i.test(msg) ||
    /Service Unavailable/i.test(msg)
  );
}

const MAX_REFUNDS_PER_MONTH = 3;

export const tryonRouter = {
  getSupportedCategories: publicProcedure.query(({ ctx }) => {
    return ctx.tryOnProvider?.supportedCategories ?? [];
  }),

  requestRender: renderProcedure
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
        .where(
          and(eq(garments.id, input.garmentId), eq(garments.userId, userId)),
        )
        .limit(1);

      const garment = garmentResult[0];
      if (!garment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "GARMENT_NOT_FOUND",
        });
      }

      // Validate category is supported by active provider
      if (
        ctx.tryOnProvider.supportedCategories.length > 0 &&
        !ctx.tryOnProvider.supportedCategories.includes(garment.category)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_CATEGORY",
        });
      }

      // Check credit balance before creating render
      const creditService = createCreditService({ db: ctx.db });
      const hasCredits = await creditService.hasCreditsRemaining(userId);
      if (!hasCredits) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "INSUFFICIENT_CREDITS",
        });
      }

      // Create render record
      const [renderRecord] = await ctx.db
        .insert(tryOnRenders)
        .values({
          userId,
          garmentId: input.garmentId,
          provider: ctx.tryOnProvider.name as
            | "fal_fashn"
            | "fal_nano_banana"
            | "google_vto",
          status: "pending",
        })
        .returning({ id: tryOnRenders.id });

      if (!renderRecord) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "RENDER_RECORD_FAILED",
        });
      }

      // Get image paths (wrap service errors in TRPCError)
      let personImagePath: string;
      let garmentImagePath: string;
      try {
        personImagePath = ctx.imageStorage.getAbsolutePath(bodyPhoto.filePath);
        garmentImagePath = ctx.imageStorage.getAbsolutePath(
          garment.cutoutPath ?? garment.imagePath,
        );
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "INVALID_IMAGE_PATH",
        });
      }

      // Call provider (retry once for 5xx errors)
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
          // Only retry on 5xx errors, and only on first attempt
          if (attempt < maxAttempts && is5xxError(error)) {
            continue;
          }

          // Non-retryable error or second attempt failed — mark as failed
          await ctx.db
            .update(tryOnRenders)
            .set({ status: "failed", errorCode: "RENDER_FAILED" })
            .where(eq(tryOnRenders.id, renderRecord.id));

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "RENDER_FAILED",
          });
        }
      }

      // Should never reach here, but satisfy TypeScript
      /* istanbul ignore next */
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "RENDER_FAILED",
      });
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

      // Always resolve person/garment image URLs for cross-fade
      const bodyPhotoResult = await ctx.db
        .select({ id: bodyPhotos.id })
        .from(bodyPhotos)
        .where(eq(bodyPhotos.userId, render.userId))
        .limit(1);

      const bodyPhoto = bodyPhotoResult[0];
      const personImageUrl = bodyPhoto ? `/api/images/${bodyPhoto.id}` : null;
      const garmentImageUrl = `/api/images/${render.garmentId}`;

      // Timeout check
      const renderTimeoutMs = ctx.renderTimeoutMs ?? 30000;
      if (
        (render.status === "pending" || render.status === "processing") &&
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
          garmentId: render.garmentId,
          personImageUrl,
          garmentImageUrl,
        };
      }

      return {
        status: render.status,
        resultImageUrl:
          render.status === "completed"
            ? `/api/images/render/${render.id}`
            : null,
        errorCode: render.errorCode,
        garmentId: render.garmentId,
        personImageUrl,
        garmentImageUrl,
      };
    }),
  submitFeedback: protectedProcedure
    .input(
      z.object({
        renderId: z.string(),
        rating: z.enum(["thumbs_up", "thumbs_down"]),
        category: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Validate render exists and belongs to user
      const renderResult = await ctx.db
        .select()
        .from(tryOnRenders)
        .where(eq(tryOnRenders.id, input.renderId))
        .limit(1);

      const render = renderResult[0];
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
      if (!render || render.userId !== userId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RENDER_NOT_FOUND",
        });
      }

      if (render.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RENDER_NOT_COMPLETED",
        });
      }

      // Insert feedback (unique constraint on renderId prevents duplicates)
      try {
        await ctx.db.insert(renderFeedback).values({
          renderId: input.renderId,
          userId,
          rating: input.rating,
          category:
            input.rating === "thumbs_down" ? (input.category ?? null) : null,
        });
      } catch (error) {
        // PostgreSQL unique constraint violation (Drizzle wraps pg driver errors)
        if (
          error instanceof Error &&
          error.message.includes("unique constraint")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "FEEDBACK_ALREADY_SUBMITTED",
          });
        }
        // Re-throw unexpected errors (connection timeouts, deadlocks, etc.)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "FEEDBACK_INSERT_FAILED",
        });
      }

      // If thumbs_down, refund credit (capped at MAX_REFUNDS_PER_MONTH per 30-day window)
      let shouldRefund = false;
      if (input.rating === "thumbs_down") {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [refundCount] = await ctx.db
          .select({ count: count() })
          .from(renderFeedback)
          .where(
            and(
              eq(renderFeedback.userId, userId),
              eq(renderFeedback.rating, "thumbs_down"),
              gt(renderFeedback.createdAt, thirtyDaysAgo),
            ),
          );
        shouldRefund = (refundCount?.count ?? 0) < MAX_REFUNDS_PER_MONTH;

        if (shouldRefund) {
          await ctx.db.transaction(async (tx) => {
            await tx
              .update(tryOnRenders)
              .set({ creditConsumed: false })
              .where(eq(tryOnRenders.id, input.renderId));

            const creditSvc = createCreditService({ db: tx });
            await creditSvc.refundCredit(userId);
          });
        }
      }

      return {
        success: true,
        creditRefunded: input.rating === "thumbs_down" && shouldRefund,
      };
    }),
} satisfies TRPCRouterRecord;
