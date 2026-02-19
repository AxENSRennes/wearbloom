import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";

import { PaywallScreen } from "~/components/subscription/PaywallScreen";

export default function PaywallRoute() {
  const router = useRouter();
  const { garmentId } = useLocalSearchParams<{ garmentId?: string }>();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/(tabs)/" as Href);
    }
  };

  const handleSuccess = (pendingGarmentId?: string) => {
    const route = pendingGarmentId
      ? `/(auth)/(tabs)/?pendingGarmentId=${encodeURIComponent(pendingGarmentId)}`
      : "/(auth)/(tabs)/";
    router.replace(route as Href);
  };

  return (
    <PaywallScreen
      onClose={handleClose}
      onSuccess={handleSuccess}
      garmentId={garmentId}
    />
  );
}
