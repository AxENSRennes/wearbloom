import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

export function useSubscription() {
  const { data, isLoading, refetch } = useQuery(
    trpc.subscription.getStatus.queryOptions(),
  );

  return {
    state: data?.state ?? "no_subscription",
    isSubscriber: data?.isSubscriber ?? false,
    rendersAllowed: data?.rendersAllowed ?? false,
    isUnlimited: data?.isUnlimited ?? false,
    expiresAt: data?.expiresAt ?? null,
    productId: data?.productId ?? null,
    hadSubscription: data?.hadSubscription ?? false,
    isLoading,
    refetch,
  };
}
