import { View } from "react-native";
import { Redirect, Slot } from "expo-router";

import { Spinner } from "@acme/ui";

import { authClient } from "~/utils/auth";

export default function AuthLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (!session || session.user.isAnonymous) {
    return <Redirect href="/(public)/sign-in" />;
  }

  return <Slot />;
}
