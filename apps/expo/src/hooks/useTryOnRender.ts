import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

const MAX_POLLS = 15; // 30s at 2s intervals

export function useTryOnRender() {
  const [renderId, setRenderId] = useState<string | null>(null);
  const pollCount = useRef(0);

  const requestMutation = useMutation(
    trpc.tryon.requestRender.mutationOptions(),
  );

  const statusQuery = useQuery({
    ...trpc.tryon.getRenderStatus.queryOptions(
      { renderId: renderId ?? "" },
    ),
    enabled: !!renderId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      if (pollCount.current >= MAX_POLLS) return false;
      pollCount.current++;
      return 2000;
    },
  });

  const startRender = useCallback(
    (garmentId: string) => {
      requestMutation.mutate(
        { garmentId },
        {
          onSuccess: (data) => {
            setRenderId(data.renderId);
            pollCount.current = 0;
          },
        },
      );
    },
    [requestMutation],
  );

  const reset = useCallback(() => {
    setRenderId(null);
    pollCount.current = 0;
  }, []);

  return {
    startRender,
    reset,
    renderId,
    status:
      statusQuery.data?.status ??
      (requestMutation.isPending ? "submitting" : null),
    resultImageUrl: statusQuery.data?.resultImageUrl ?? null,
    errorCode: statusQuery.data?.errorCode ?? null,
    isPending: requestMutation.isPending,
    isPolling:
      !!renderId &&
      statusQuery.data?.status !== "completed" &&
      statusQuery.data?.status !== "failed",
  };
}
