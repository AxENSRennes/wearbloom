import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { showToast } from "@acme/ui";

import { trpc } from "~/utils/api";
import { processQueue } from "~/utils/uploadQueue";

import { useNetworkStatus } from "./useNetworkStatus";

export function useReconnectSync() {
  const queryClient = useQueryClient();
  const uploadMutation = useMutation(trpc.garment.upload.mutationOptions());

  const handleReconnect = useCallback(() => {
    // Invalidate wardrobe data to get fresh list
    void queryClient.invalidateQueries({
      queryKey: trpc.garment.list.queryKey(),
    });

    // Process any queued offline uploads
    void processQueue(async (payload) => {
      const formData = new FormData();
      formData.append("photo", {
        uri: payload.imageUri,
        type: "image/jpeg",
        name: "garment.jpg",
      } as unknown as Blob);
      formData.append("category", payload.category);
      formData.append("width", String(payload.width));
      formData.append("height", String(payload.height));
      await uploadMutation.mutateAsync(formData);
    });

    // Show reconnection toast
    showToast({ message: "Back online", variant: "info" });
  }, [queryClient, uploadMutation]);

  useNetworkStatus({ onReconnect: handleReconnect });
}
