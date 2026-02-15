import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react-native";

import { Button, showToast, ThemedText, wearbloomTheme } from "@acme/ui";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";
import { compressImage } from "~/utils/image-compressor";

export function BodyPhotoManager() {
  const queryClient = useQueryClient();
  const bodyPhotoQuery = useQuery(trpc.user.getBodyPhoto.queryOptions());
  const uploadMutation = useMutation(
    trpc.user.uploadBodyPhoto.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.user.getBodyPhoto.queryKey(),
        });
        showToast({ message: "Photo saved successfully!", variant: "success" });
      },
      onError: () => {
        showToast({
          message: "Photo upload failed. Please try again.",
          variant: "error",
        });
      },
    }),
  );

  const cookies = authClient.getCookie();
  const hasPhoto = bodyPhotoQuery.data != null;
  const imageUrl = bodyPhotoQuery.data
    ? `${getBaseUrl()}${bodyPhotoQuery.data.imageUrl}`
    : null;

  async function handleUpload(source: "camera" | "gallery") {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          showToast({
            message: "Camera permission is required to take a photo.",
            variant: "error",
          });
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 1,
        });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
          showToast({
            message: "Photo library permission is required.",
            variant: "error",
          });
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 1,
        });
      }

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const compressed = await compressImage(asset.uri);

      const formData = new FormData();
      formData.append("photo", {
        uri: compressed.uri,
        type: "image/jpeg",
        name: "body-avatar.jpg",
      } as unknown as Blob);
      formData.append("width", String(compressed.width));
      formData.append("height", String(compressed.height));

      uploadMutation.mutate(formData);
    } catch {
      showToast({
        message: "Could not process the photo. Please try again.",
        variant: "error",
      });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        {hasPhoto && imageUrl ? (
          <>
            <View
              className="mb-6 h-64 w-64 overflow-hidden rounded-2xl border-2 border-border"
              accessibilityRole="image"
              accessibilityLabel="Your body avatar photo"
            >
              <Image
                source={{
                  uri: imageUrl,
                  headers: cookies ? { Cookie: cookies } : undefined,
                }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
            <Button
              label="Update Photo"
              variant="secondary"
              onPress={() => handleUpload("gallery")}
              isLoading={uploadMutation.isPending}
              disabled={uploadMutation.isPending}
            />
          </>
        ) : (
          <>
            <View
              className="mb-6 h-40 w-40 items-center justify-center rounded-full bg-surface"
              accessibilityRole="image"
              accessibilityLabel="Body photo placeholder"
            >
              <User
                size={64}
                color={wearbloomTheme.colors["text-tertiary"]}
              />
            </View>
            <ThemedText variant="heading" className="mb-2 text-center">
              Add Your Body Photo
            </ThemedText>
            <ThemedText
              variant="body"
              className="mb-8 text-center text-text-secondary"
            >
              Take or import a full-body photo so AI try-on can show garments on
              you.
            </ThemedText>
            <View className="w-full gap-3">
              <Button
                label="Take Photo"
                variant="primary"
                onPress={() => handleUpload("camera")}
                isLoading={uploadMutation.isPending}
                disabled={uploadMutation.isPending}
              />
              <Button
                label="Import from Gallery"
                variant="secondary"
                onPress={() => handleUpload("gallery")}
                isLoading={uploadMutation.isPending}
                disabled={uploadMutation.isPending}
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
