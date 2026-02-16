import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { Button, ThemedText } from "@acme/ui";

import { trpc } from "~/utils/api";
import { getBaseUrl } from "~/utils/base-url";

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Creating your look...",
  processing: "Almost there...",
  submitting: "Sending to AI...",
};

export default function RenderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    ...trpc.tryon.getRenderStatus.queryOptions({ renderId: id ?? "" }),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 2000;
    },
  });

  const status = data?.status ?? "pending";
  const isTerminal = status === "completed" || status === "failed";

  if (status === "completed" && data?.resultImageUrl) {
    const imageUri = `${getBaseUrl()}${data.resultImageUrl}`;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1">
          <Image
            source={{ uri: imageUri }}
            style={{ flex: 1 }}
            contentFit="contain"
          />
        </View>
        <View className="p-4">
          <Button
            variant="secondary"
            label="Back to Wardrobe"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "failed") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ThemedText variant="heading">Render Failed</ThemedText>
          <ThemedText
            variant="body"
            className="mt-2 text-center text-text-secondary"
          >
            {data?.errorCode === "RENDER_TIMEOUT"
              ? "The render took too long. Please try again."
              : "Something went wrong. Please try again."}
          </ThemedText>
          <View className="mt-6">
            <Button
              variant="secondary"
              label="Back to Wardrobe"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Loading/polling state
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-4">
        <ActivityIndicator size="large" color="#4c6ef5" />
        <ThemedText variant="body" className="mt-4 text-text-secondary">
          {STATUS_MESSAGES[status] ?? "Creating your look..."}
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}
