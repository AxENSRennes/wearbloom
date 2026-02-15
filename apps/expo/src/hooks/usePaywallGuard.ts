import { useCallback } from "react";
import { useRouter } from "expo-router";

import { useSubscriptionStatus } from "./useSubscriptionStatus";

export function usePaywallGuard() {
  const router = useRouter();
  const { canRender, isSubscriber } = useSubscriptionStatus();

  const guardRender = useCallback(
    (garmentId: string): boolean => {
      if (canRender || isSubscriber) return true;

      router.push({
        pathname: "/(public)/paywall",
        params: { garmentId },
      });
      return false;
    },
    [canRender, isSubscriber, router],
  );

  return { guardRender };
}
