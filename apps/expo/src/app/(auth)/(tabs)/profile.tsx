import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react-native";

import {
  Button,
  showToast,
  ThemedPressable,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import { CreditCounter } from "~/components/subscription/CreditCounter";
import { authClient } from "~/utils/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      router.replace("/(public)/sign-in");
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || "Sign out failed",
        variant: "error",
      });
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 p-4">
        <View className="items-center py-8">
          <ThemedText variant="display">Profile</ThemedText>
          <ThemedText variant="body" className="mt-2 text-text-secondary">
            Account settings & preferences
          </ThemedText>
        </View>

        {session?.user && (
          <View className="rounded-xl bg-surface p-4">
            <ThemedText variant="title">{session.user.name}</ThemedText>
            <ThemedText variant="caption" className="mt-1 text-text-secondary">
              {session.user.email}
            </ThemedText>
          </View>
        )}

        <View className="mt-auto gap-2 pb-4">
          <ThemedText variant="caption" className="px-1 text-text-secondary">
            Subscription
          </ThemedText>
          <View className="rounded-xl bg-surface px-4 py-3">
            <CreditCounter />
          </View>

          <ThemedText variant="caption" className="mt-2 px-1 text-text-secondary">
            Legal
          </ThemedText>
          <ThemedPressable
            className="flex-row items-center justify-between rounded-xl bg-surface px-4 py-3"
            onPress={() => router.push("/(public)/privacy")}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            <ThemedText variant="body" className="text-text-secondary">
              Privacy Policy
            </ThemedText>
            <ChevronRight
              size={20}
              color={wearbloomTheme.colors["text-tertiary"]}
            />
          </ThemedPressable>

          <View className="mt-4">
            <Button
              label="Sign Out"
              variant="secondary"
              onPress={() => signOutMutation.mutate()}
              isLoading={signOutMutation.isPending}
              disabled={signOutMutation.isPending}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
