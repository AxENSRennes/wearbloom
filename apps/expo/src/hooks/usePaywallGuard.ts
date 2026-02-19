import type { Href } from "expo-router";
import { useCallback } from "react";
import { useRouter } from "expo-router";

import { useSubscriptionStatus } from "./useSubscriptionStatus";

export function usePaywallGuard() {
  const router = useRouter();
  const { canRender, isSubscriber, isLoading } = useSubscriptionStatus();

  const guardRender = useCallback(
    (garmentId: string): boolean => {
      if (isLoading) return true;
      if (canRender || isSubscriber) return true;

      router.push(
        `/(auth)/paywall?garmentId=${encodeURIComponent(garmentId)}` as Href,
      );
      return false;
    },
    [canRender, isLoading, isSubscriber, router],
  );

  return { guardRender };
}
