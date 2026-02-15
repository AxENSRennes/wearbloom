import { useRouter, useLocalSearchParams } from "expo-router";

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

  const handleSuccess = () => {
    router.replace("/(auth)/(tabs)/");
  };

  return (
    <PaywallScreen
      onClose={handleClose}
      onSuccess={handleSuccess}
      garmentId={garmentId}
    />
  );
}
