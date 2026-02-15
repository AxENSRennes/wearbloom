import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@acme/ui";

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-4">
        <ThemedText variant="display">Profile</ThemedText>
        <ThemedText variant="body" className="mt-2 text-text-secondary">
          Account settings & preferences
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
