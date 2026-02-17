import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, User } from "lucide-react-native";

import {
  AlertDialog,
  Button,
  showToast,
  ThemedPressable,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import { CreditCounter } from "~/components/subscription/CreditCounter";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const bodyPhotoQuery = useQuery(trpc.user.getBodyPhoto.queryOptions());

  const cookies = authClient.getCookie();
  const hasBodyPhoto = bodyPhotoQuery.data != null;
  const bodyPhotoUrl = bodyPhotoQuery.data
    ? `${getBaseUrl()}${bodyPhotoQuery.data.imageUrl}`
    : null;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteAccountMutation = useMutation({
    ...trpc.user.deleteAccount.mutationOptions(),
    onSuccess: async () => {
      await authClient.signOut();
      router.replace("/(public)/sign-in");
    },
    onError: () => {
      showToast({
        message: "Account deletion failed. Please try again.",
        variant: "error",
      });
      setShowDeleteDialog(false);
    },
  });

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

        {/* Body Avatar Section */}
        <View className="mb-4 items-center">
          {hasBodyPhoto && bodyPhotoUrl ? (
            <View
              className="h-[120px] w-[120px] overflow-hidden rounded-full border-2 border-border"
              accessibilityRole="image"
              accessibilityLabel="Your body avatar"
            >
              <Image
                source={{
                  uri: bodyPhotoUrl,
                  headers: cookies ? { Cookie: cookies } : undefined,
                }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
          ) : (
            <View
              className="h-[120px] w-[120px] items-center justify-center rounded-full bg-surface"
              accessibilityRole="image"
              accessibilityLabel="Body photo placeholder"
            >
              <User size={48} color={wearbloomTheme.colors["text-tertiary"]} />
            </View>
          )}
        </View>

        <ThemedPressable
          className="mb-4 flex-row items-center justify-between rounded-xl bg-surface px-4 py-3"
          onPress={() => router.push("/(auth)/body-photo")}
          accessibilityRole="button"
          accessibilityLabel={
            hasBodyPhoto ? "Update Body Photo" : "Add Body Photo"
          }
          accessibilityHint="Navigate to body photo management screen"
        >
          <ThemedText
            variant="body"
            className={hasBodyPhoto ? "text-text-secondary" : "text-accent"}
          >
            {hasBodyPhoto ? "Update Body Photo" : "Add Body Photo"}
          </ThemedText>
          <ChevronRight
            size={20}
            color={wearbloomTheme.colors["text-tertiary"]}
          />
        </ThemedPressable>

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

          <ThemedText
            variant="caption"
            className="mt-2 px-1 text-text-secondary"
          >
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

          {/* Danger Zone */}
          <View className="mt-4 gap-2">
            <ThemedText variant="caption" className="px-1 text-error">
              Danger Zone
            </ThemedText>
            <ThemedPressable
              className="h-[44px] w-full items-center justify-center rounded-xl bg-transparent"
              onPress={() => setShowDeleteDialog(true)}
              accessibilityRole="button"
              accessibilityLabel="Delete Account"
            >
              <ThemedText variant="body" className="font-semibold text-error">
                Delete Account
              </ThemedText>
            </ThemedPressable>
          </View>

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

        <AlertDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={() => deleteAccountMutation.mutate()}
          title="Delete Account?"
          message="This will permanently delete your account and all associated data. This action cannot be undone."
          confirmLabel="Delete Account"
          variant="destructive"
          isLoading={deleteAccountMutation.isPending}
        />
      </View>
    </SafeAreaView>
  );
}
