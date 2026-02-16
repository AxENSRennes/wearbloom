import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { showToast } from "@acme/ui";

import { trpc } from "~/utils/api";
import { processQueue } from "~/utils/upload-queue";

import { useNetworkStatus } from "./useNetworkStatus";

export function useReconnectSync() {
  const queryClient = useQueryClient();

  const handleReconnect = useCallback(() => {
    // Invalidate wardrobe data to get fresh list
    void queryClient.invalidateQueries({
      queryKey: trpc.garment.list.queryKey(),
    });

    // Process any queued offline uploads
    void processQueue(async (_payload) => {
      // The actual upload mutation will be called by the queue processor
      // For now, this is a placeholder — the real upload logic requires
      // creating FormData from the stored imageUri, which will be handled
      // when the upload infrastructure supports it
    });

    // Show reconnection toast
    showToast({ message: "Back online", variant: "info" });
  }, [queryClient]);

  useNetworkStatus({ onReconnect: handleReconnect });
}
