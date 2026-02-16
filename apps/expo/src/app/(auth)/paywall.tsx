import { useLocalSearchParams, useRouter } from "expo-router";

import { PaywallScreen } from "~/components/subscription/PaywallScreen";

export default function PaywallRoute() {
  const router = useRouter();
  const { garmentId } = useLocalSearchParams<{ garmentId?: string }>();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/(tabs)/");
    }
  };

  const handleSuccess = (pendingGarmentId?: string) => {
    router.replace({
      pathname: "/(auth)/(tabs)/",
      params: pendingGarmentId ? { pendingGarmentId } : undefined,
    });
  };

  return (
    <PaywallScreen
      onClose={handleClose}
      onSuccess={handleSuccess}
      garmentId={garmentId}
    />
  );
}
