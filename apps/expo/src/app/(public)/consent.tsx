import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, ThemedText } from "@acme/ui";

import { setConsentAccepted } from "~/utils/consent-store";

export default function ConsentScreen() {
  const router = useRouter();

  const handleAccept = () => {
    setConsentAccepted();
    router.replace("/");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View className="flex-1 justify-center px-4">
        <View className="items-center gap-6">
          <ThemedText variant="display" className="text-center">
            Wearbloom
          </ThemedText>

          <ThemedText
            variant="body"
            className="text-center text-text-secondary"
          >
            We collect your photos and wardrobe data to power AI try-on. Your
            data is stored securely and never shared with third parties.
          </ThemedText>

          <ThemedText
            variant="body"
            className="text-text-secondary underline"
            accessible
            accessibilityRole="link"
            accessibilityLabel="Read our Privacy Policy"
            onPress={() => router.push("/(public)/privacy")}
          >
            Read our Privacy Policy
          </ThemedText>
        </View>
      </View>

      <View className="px-4 pb-6">
        <Button
          label="Accept & Continue"
          variant="primary"
          onPress={handleAccept}
        />
      </View>
    </SafeAreaView>
  );
}
