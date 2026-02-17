import type { ReactElement } from "react";
import { View } from "react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";

import { Button, ThemedText, wearbloomTheme } from "@acme/ui";

export function StockPhotoReplacementBanner(): ReactElement {
  const router = useRouter();

  return (
    <View
      className="rounded-xl bg-accent-highlight-soft p-4"
      accessibilityRole="summary"
      accessibilityLabel="You're using an example body photo"
    >
      <View className="flex-row items-center gap-3">
        <Camera size={24} color={wearbloomTheme.colors.accent} />
        <View className="flex-1">
          <ThemedText variant="body" className="font-semibold">
            You&apos;re using an example photo
          </ThemedText>
          <ThemedText variant="caption" className="mt-0.5 text-text-secondary">
            Add your own for more realistic try-ons
          </ThemedText>
        </View>
      </View>
      <View className="mt-3">
        <Button
          label="Add Your Photo"
          variant="secondary"
          onPress={() => router.push("/(auth)/body-photo" as Href)}
        />
      </View>
    </View>
  );
}
