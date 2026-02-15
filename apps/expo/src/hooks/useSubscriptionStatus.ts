import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export function useSubscriptionStatus() {
  const { data, isLoading } = useQuery(
    trpc.subscription.getSubscriptionStatus.queryOptions(),
  );

  return {
    isSubscriber: data?.isSubscriber ?? false,
    creditsRemaining: data?.creditsRemaining ?? 0,
    state: data?.state ?? "free_no_credits",
    isLoading,
    canRender: data?.canRender ?? false,
  };
}
