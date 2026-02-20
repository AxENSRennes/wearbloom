import type { Href } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { Button, ThemedPressable, ThemedText } from "@acme/ui";

import { setConsentAccepted } from "~/utils/consent-store";

export default function ConsentScreen() {
  const router = useRouter();

  const handleAccept = async () => {
    await setConsentAccepted();
    router.replace("/" as Href);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="flex-grow justify-center py-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-6">
          <ThemedText variant="display" className="text-center">
            Wearbloom
          </ThemedText>

          <ThemedText
            variant="body"
            className="text-center text-text-secondary"
          >
            We collect your photos and wardrobe data to power AI try-on. Your
            photos are processed by third-party AI services (FASHN AI, Bria AI,
            and Google) to generate virtual try-on results and remove garment
            backgrounds. Photos are not retained by these providers after
            processing. Your data is not used for advertising or marketing.
          </ThemedText>

          <ThemedPressable
            onPress={() => router.push("/(public)/privacy" as Href)}
            accessible
            accessibilityRole="link"
            accessibilityLabel="Read our Privacy Policy"
          >
            <ThemedText
              variant="body"
              className="text-text-secondary underline"
            >
              Read our Privacy Policy
            </ThemedText>
          </ThemedPressable>
        </View>
      </ScrollView>

      <View className="px-4 pb-6 pt-2">
        <Button
          label="Accept & Continue"
          variant="primary"
          onPress={handleAccept}
        />
      </View>
    </SafeAreaView>
  );
}
