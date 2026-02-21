import type { Href } from "expo-router";
import { Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

import { ThemedText, wearbloomTheme } from "@acme/ui";

import { BodyPhotoManager } from "~/components/profile/BodyPhotoManager";

export default function BodyPhotoScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(auth)/(tabs)/" as Href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleBack}
              className="-ml-1 flex-row items-center gap-1 px-2 py-1"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft
                size={18}
                color={wearbloomTheme.colors["text-secondary"]}
              />
              <ThemedText variant="body" className="text-text-secondary">
                Back
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <BodyPhotoManager />
    </>
  );
}
