import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function Index() {
  return (
    <SafeAreaView className="bg-white flex-1">
      <Stack.Screen options={{ title: "Wearbloom" }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-3xl font-bold text-neutral-900">Wearbloom</Text>
        <Text className="mt-2 text-lg text-neutral-500">
          Virtual try-on experience
        </Text>
      </View>
    </SafeAreaView>
  );
}
