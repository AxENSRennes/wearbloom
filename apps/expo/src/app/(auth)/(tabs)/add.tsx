import { useCallback, useReducer, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageIcon } from "lucide-react-native";

import {
  ActionSheet,
  Button,
  showToast,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import { CategoryPills } from "~/components/garment/CategoryPills";
import { trpc } from "~/utils/api";
import { compressImage } from "~/utils/image-compressor";

/**
 * Garment categories. MUST stay in sync with GARMENT_CATEGORIES in
 * packages/db/src/schema.ts and VALID_CATEGORIES in packages/api/src/router/garment.ts
 */
const CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"] as const;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type AddState =
  | { step: "idle" }
  | {
      step: "previewing";
      imageUri: string;
      width: number;
      height: number;
    }
  | {
      step: "uploading";
      imageUri: string;
      width: number;
      height: number;
      category: string;
    }
  | { step: "success"; garmentId: string };

export type AddAction =
  | { type: "PHOTO_SELECTED"; uri: string; width: number; height: number }
  | { type: "UPLOAD_START"; category: string }
  | { type: "UPLOAD_SUCCESS"; garmentId: string }
  | { type: "UPLOAD_ERROR" }
  | { type: "RETAKE" }
  | { type: "ADD_ANOTHER" };

export function addGarmentReducer(state: AddState, action: AddAction): AddState {
  switch (action.type) {
    case "PHOTO_SELECTED":
      return {
        step: "previewing",
        imageUri: action.uri,
        width: action.width,
        height: action.height,
      };
    case "UPLOAD_START":
      return {
        step: "uploading",
        imageUri:
          state.step === "previewing" ? state.imageUri : "",
        width: state.step === "previewing" ? state.width : 0,
        height: state.step === "previewing" ? state.height : 0,
        category: action.category,
      };
    case "UPLOAD_SUCCESS":
      return { step: "success", garmentId: action.garmentId };
    case "UPLOAD_ERROR":
      return state.step === "uploading"
        ? {
            step: "previewing",
            imageUri: state.imageUri,
            width: state.width,
            height: state.height,
          }
        : state;
    case "RETAKE":
    case "ADD_ANOTHER":
      return { step: "idle" };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddGarmentScreen() {
  const [state, dispatch] = useReducer(addGarmentReducer, { step: "idle" } as AddState);
  const [selectedCategory, setSelectedCategory] = useState("tops");
  const [showActionSheet, setShowActionSheet] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation(
    trpc.garment.upload.mutationOptions({
      onSuccess: (data) => {
        dispatch({ type: "UPLOAD_SUCCESS", garmentId: data.garmentId });
        void queryClient.invalidateQueries({
          queryKey: trpc.garment.list.queryKey(),
        });
        showToast({ message: "Garment saved!", variant: "success" });
      },
      onError: (error) => {
        dispatch({ type: "UPLOAD_ERROR" });

        // Map known business error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          MISSING_PHOTO: "No photo selected. Please try again.",
          MISSING_CATEGORY: "Please select a category.",
          INVALID_CATEGORY: "Invalid category selected.",
          INVALID_IMAGE_TYPE: "Only JPEG and PNG images are supported.",
          IMAGE_TOO_LARGE: "Image is too large. Maximum size is 10MB.",
        };

        const message =
          errorMessages[error.message] ?? "Upload failed. Please try again.";
        showToast({ message, variant: "error" });
      },
    }),
  );

  const handleCapture = useCallback(
    async (source: "camera" | "gallery") => {
      try {
        let result: ImagePicker.ImagePickerResult;

        if (source === "camera") {
          const permission =
            await ImagePicker.requestCameraPermissionsAsync();
          if (permission.status !== "granted") {
            showToast({
              message: "Camera permission is required to take a photo.",
              variant: "error",
            });
            return;
          }
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
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
            quality: 1,
          });
        }

        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        const compressed = await compressImage(asset.uri);

        dispatch({
          type: "PHOTO_SELECTED",
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
        });
      } catch {
        showToast({
          message: "Could not process the photo. Please try again.",
          variant: "error",
        });
      }
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (state.step !== "previewing") return;

    dispatch({ type: "UPLOAD_START", category: selectedCategory });

    const formData = new FormData();
    formData.append("photo", {
      uri: state.imageUri,
      type: "image/jpeg",
      name: "garment.jpg",
    } as unknown as Blob);
    formData.append("category", selectedCategory);
    formData.append("width", String(state.width));
    formData.append("height", String(state.height));

    uploadMutation.mutate(formData);
  }, [state, selectedCategory, uploadMutation]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Step: Success
  if (state.step === "success") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <ThemedText variant="heading" className="mb-2 text-center">
            Garment Saved!
          </ThemedText>
          <ThemedText
            variant="body"
            className="mb-8 text-center text-text-secondary"
          >
            Your garment has been added to your wardrobe.
          </ThemedText>
          <View className="w-full gap-3">
            <Button
              label="Add Another"
              variant="secondary"
              onPress={() => dispatch({ type: "ADD_ANOTHER" })}
            />
            <Pressable
              className="items-center justify-center py-3"
              accessibilityRole="button"
              accessibilityLabel="Browse wardrobe"
              onPress={() => router.push("/(auth)/(tabs)/home")}
            >
              <ThemedText variant="body" className="text-text-secondary">
                Browse Wardrobe
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step: Previewing / Uploading
  if (state.step === "previewing" || state.step === "uploading") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 p-6">
          {/* Header */}
          <ThemedText variant="heading" className="mb-4 text-center">
            Preview & Categorize
          </ThemedText>

          {/* Image Preview */}
          <View className="mb-6 flex-1 items-center justify-center">
            <View
              className="aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-white"
              accessibilityRole="image"
              accessibilityLabel="Garment photo preview"
            >
              <Image
                source={{ uri: state.imageUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            </View>
          </View>

          {/* Category Selection */}
          <View className="mb-6">
            <ThemedText variant="caption" className="mb-2 text-text-secondary">
              Select Category
            </ThemedText>
            <CategoryPills
              categories={CATEGORIES}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </View>

          {/* Actions */}
          <View className="gap-3">
            <Button
              label="Save to Wardrobe"
              variant="primary"
              onPress={handleSave}
              isLoading={uploadMutation.isPending}
              disabled={uploadMutation.isPending}
            />
            <Button
              label="Retake"
              variant="secondary"
              onPress={() => dispatch({ type: "RETAKE" })}
              disabled={uploadMutation.isPending}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Step: Idle — Source selection
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6">
        <ThemedText variant="heading" className="mb-2 text-center">
          Add a Garment
        </ThemedText>
        <ThemedText
          variant="body"
          className="mb-8 text-center text-text-secondary"
        >
          Take a photo of your garment or import one from your gallery.
        </ThemedText>

        {/* Photography tips */}
        <View className="mb-6 w-full rounded-xl bg-surface p-4">
          <ThemedText variant="caption" className="mb-1 font-semibold text-text-primary">
            Tips for best results
          </ThemedText>
          <ThemedText variant="caption" className="text-text-secondary">
            • Place garment flat on a plain surface{"\n"}
            • Use good, even lighting{"\n"}
            • Avoid wrinkles and shadows{"\n"}
            • Capture the full garment in frame
          </ThemedText>
        </View>

        <View className="w-full gap-3">
          <Button
            label="Add Garment"
            variant="primary"
            onPress={() => setShowActionSheet(true)}
          />
        </View>

        <ActionSheet
          isOpen={showActionSheet}
          onClose={() => setShowActionSheet(false)}
          items={[
            {
              label: "Take Photo",
              icon: (
                <Camera
                  size={20}
                  color={wearbloomTheme.colors["text-primary"]}
                />
              ),
              onPress: () => handleCapture("camera"),
            },
            {
              label: "Import from Gallery",
              icon: (
                <ImageIcon
                  size={20}
                  color={wearbloomTheme.colors["text-primary"]}
                />
              ),
              onPress: () => handleCapture("gallery"),
            },
          ]}
        />
      </View>
    </SafeAreaView>
  );
}
