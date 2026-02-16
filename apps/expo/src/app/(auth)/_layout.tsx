import { View } from "react-native";
import { Redirect, Stack } from "expo-router";

import { Spinner } from "@acme/ui";

import { useReconnectSync } from "~/hooks/useReconnectSync";
import { authClient } from "~/utils/auth";

export default function AuthLayout() {
  const { data: session, isPending } = authClient.useSession();
  useReconnectSync();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(public)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="body-photo" />
      <Stack.Screen
        name="render/[id]"
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
          animation: "fade",
        }}
      />
    </Stack>
  );
}
