import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@acme/ui";

export default function PrivacyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-4">
        <ThemedText variant="display">Privacy Policy</ThemedText>
        <ThemedText variant="body" className="mt-2 text-text-secondary">
          How we handle your data
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
