import { useCallback, useState } from "react";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";

import type { GarmentCategory } from "~/constants/stockAssets";
import { OnboardingFlow } from "~/components/onboarding/OnboardingFlow";

export default function OnboardingScreen() {
  const router = useRouter();
  const [bodyPhoto, setBodyPhoto] = useState<{
    uri: string;
    isStock: boolean;
  } | null>(null);
  const [garment, setGarment] = useState<{
    uri: string;
    category: GarmentCategory;
    isStock: boolean;
  } | null>(null);

  const handlePhotoSelected = useCallback((uri: string, isStock: boolean) => {
    setBodyPhoto({ uri, isStock });
  }, []);

  const handleGarmentSelected = useCallback(
    (uri: string, category: GarmentCategory, isStock: boolean) => {
      setGarment({ uri, category, isStock });
    },
    [],
  );

  const handleCreateAccount = useCallback(() => {
    router.push({
      pathname: "/(public)/sign-up",
      params: { from: "onboarding" },
    } as unknown as Href);
  }, [router]);

  const handleTryAnother = useCallback(() => {
    setGarment(null);
  }, []);

  return (
    <OnboardingFlow
      onPhotoSelected={handlePhotoSelected}
      onGarmentSelected={handleGarmentSelected}
      onCreateAccount={handleCreateAccount}
      onTryAnother={handleTryAnother}
      bodyPhotoUri={bodyPhoto?.uri}
      garmentUri={garment?.uri}
    />
  );
}
