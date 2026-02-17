import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "~/utils/api";
import { getOnboardingBodyPhotoSource } from "~/utils/onboardingState";

export function useStockPhotoStatus() {
  const [source, setSource] = useState<"stock" | "own" | null>(null);
  const [sourceLoaded, setSourceLoaded] = useState(false);

  const bodyPhotoQuery = useQuery(trpc.user.getBodyPhoto.queryOptions());

  useEffect(() => {
    void getOnboardingBodyPhotoSource().then((s) => {
      setSource(s);
      setSourceLoaded(true);
    });
  }, []);

  const hasDbPhoto = bodyPhotoQuery.data != null;
  const isLoading = !sourceLoaded || bodyPhotoQuery.isLoading;

  // If body photo exists in DB, user has their own photo regardless of onboarding source
  const usedStockBodyPhoto = hasDbPhoto ? false : source === "stock";

  return { usedStockBodyPhoto, isLoading };
}
