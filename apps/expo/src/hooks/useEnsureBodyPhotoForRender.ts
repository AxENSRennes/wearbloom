import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { getOnboardingBodyPhotoSource } from "~/utils/onboardingState";
import { uploadStockBodyPhoto } from "~/utils/stockBodyPhotoUpload";

export type EnsureBodyPhotoStatus = "ready" | "missing" | "error";

export function useEnsureBodyPhotoForRender() {
  const queryClient = useQueryClient();
  const uploadBodyPhotoMutation = useMutation(
    trpc.user.uploadBodyPhoto.mutationOptions(),
  );

  const ensureBodyPhotoForRender = useCallback(async () => {
    try {
      const bodyPhoto = await queryClient.fetchQuery(
        trpc.user.getBodyPhoto.queryOptions(),
      );
      if (bodyPhoto) {
        return { status: "ready" as const };
      }
    } catch {
      return { status: "error" as const };
    }

    const source = await getOnboardingBodyPhotoSource().catch(() => null);
    if (source !== "stock") {
      return { status: "missing" as const };
    }

    const uploadResult = await uploadStockBodyPhoto({
      uploadBodyPhoto: uploadBodyPhotoMutation.mutateAsync,
    });
    if (!uploadResult.success) {
      return { status: "missing" as const };
    }

    try {
      await queryClient.invalidateQueries({
        queryKey: trpc.user.getBodyPhoto.queryKey(),
      });
      const refreshedBodyPhoto = await queryClient.fetchQuery(
        trpc.user.getBodyPhoto.queryOptions(),
      );

      return refreshedBodyPhoto
        ? { status: "ready" as const }
        : { status: "missing" as const };
    } catch {
      return { status: "error" as const };
    }
  }, [queryClient, uploadBodyPhotoMutation.mutateAsync]);

  return {
    ensureBodyPhotoForRender,
    isEnsuringBodyPhoto: uploadBodyPhotoMutation.isPending,
  };
}
