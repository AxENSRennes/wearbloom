import type { Href } from "expo-router";
import type { ComponentRef } from "react";
import { useCallback, useReducer, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { createId } from "@paralleldrive/cuid2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageIcon } from "lucide-react-native";

import {
  ActionSheet,
  Button,
  showToast,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import type { GarmentCategory } from "~/constants/categories";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { GARMENT_CATEGORIES, isGarmentCategory } from "~/constants/categories";
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { trpc } from "~/utils/api";
import { appendLocalImage } from "~/utils/formData";
import { compressImage } from "~/utils/imageCompressor";
import { enqueueUpload } from "~/utils/uploadQueue";

const WARDROBE_ROUTE = "/(auth)/(tabs)/" as const;

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
      category: GarmentCategory;
    }
  | { step: "success"; garmentId: string };

export type AddAction =
  | { type: "PHOTO_SELECTED"; uri: string; width: number; height: number }
  | { type: "UPLOAD_START"; category: GarmentCategory }
  | { type: "UPLOAD_SUCCESS"; garmentId: string }
  | { type: "UPLOAD_ERROR" }
  | { type: "RETAKE" }
  | { type: "ADD_ANOTHER" };

export function addGarmentReducer(
  state: AddState,
  action: AddAction,
): AddState {
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
        imageUri: state.step === "previewing" ? state.imageUri : "",
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
  const [state, dispatch] = useReducer(addGarmentReducer, {
    step: "idle",
  } as AddState);
  const [selectedCategory, setSelectedCategory] =
    useState<GarmentCategory>("tops");
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<ComponentRef<typeof CameraView>>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isConnected } = useNetworkStatus();

  const supportedCategoriesQuery = useQuery(
    trpc.tryon.getSupportedCategories.queryOptions(),
  );
  const supportedCategories = supportedCategoriesQuery.data ?? [];
  const unsupportedCategories =
    supportedCategories.length > 0
      ? GARMENT_CATEGORIES.filter((c) => !supportedCategories.includes(c))
      : [];

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

  const handlePhotoReady = useCallback(async (uri: string) => {
    try {
      const compressed = await compressImage(uri).catch(() => null);
      if (!compressed) {
        showToast({
          message: "Could not process the photo. Please try again.",
          variant: "error",
        });
        return;
      }

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
  }, []);

  const handleOpenCamera = useCallback(async () => {
    const permission = cameraPermission ?? (await requestCameraPermission());
    if (!permission.granted) {
      showToast({
        message: "Camera permission is required to take a photo.",
        variant: "error",
      });
      return;
    }

    setShowActionSheet(false);
    setIsFlashEnabled(false);
    setIsCameraOpen(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleSelectFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (permission.status !== "granted") {
      showToast({
        message: "Photo library permission is required.",
        variant: "error",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) return;

    await handlePhotoReady(asset.uri);
    setIsCameraOpen(false);
    setShowActionSheet(false);
  }, [handlePhotoReady]);

  const handleCapture = useCallback(
    async (source: "camera" | "gallery") => {
      if (source === "camera") {
        await handleOpenCamera();
        return;
      }

      await handleSelectFromGallery();
    },
    [handleOpenCamera, handleSelectFromGallery],
  );

  const handleTakePhoto = useCallback(async () => {
    if (isTakingPhoto) return;
    if (!cameraRef.current) return;

    try {
      setIsTakingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
      });

      if (!photo.uri) {
        showToast({
          message: "Could not capture photo. Please try again.",
          variant: "error",
        });
        return;
      }

      await handlePhotoReady(photo.uri);
      setIsCameraOpen(false);
    } catch {
      showToast({
        message: "Could not capture photo. Please try again.",
        variant: "error",
      });
    } finally {
      setIsTakingPhoto(false);
    }
  }, [handlePhotoReady, isTakingPhoto]);

  const handleSave = useCallback(async () => {
    if (state.step !== "previewing") return;

    if (!isConnected) {
      enqueueUpload({
        id: createId(),
        imageUri: state.imageUri,
        category: selectedCategory,
        width: state.width,
        height: state.height,
        queuedAt: new Date().toISOString(),
      });
      dispatch({ type: "ADD_ANOTHER" });
      showToast({
        message: "Saved for upload when back online",
        variant: "info",
      });
      return;
    }

    dispatch({ type: "UPLOAD_START", category: selectedCategory });

    let formData: FormData;
    try {
      formData = new FormData();
      await appendLocalImage(formData, "photo", state.imageUri, "garment.jpg");
      formData.append("category", selectedCategory);
      formData.append("width", String(state.width));
      formData.append("height", String(state.height));
    } catch {
      dispatch({ type: "UPLOAD_ERROR" });
      showToast({
        message: "Upload failed. Please try again.",
        variant: "error",
      });
      return;
    }

    uploadMutation.mutate(formData);
  }, [state, isConnected, selectedCategory, uploadMutation]);

  if (isCameraOpen) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          flash={isFlashEnabled ? "on" : "off"}
        >
          <View className="flex-1 justify-between bg-black/20 p-6">
            <View className="flex-row items-center justify-between">
              <Pressable
                className="rounded-full bg-black/40 px-4 py-2"
                onPress={() => {
                  setIsCameraOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close camera"
              >
                <ThemedText variant="caption" className="text-white">
                  Cancel
                </ThemedText>
              </Pressable>

              <Pressable
                className="rounded-full bg-black/40 px-4 py-2"
                onPress={() => setIsFlashEnabled((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={
                  isFlashEnabled ? "Turn flash off" : "Turn flash on"
                }
              >
                <ThemedText variant="caption" className="text-white">
                  Flash {isFlashEnabled ? "On" : "Off"}
                </ThemedText>
              </Pressable>
            </View>

            <View className="items-center">
              <View
                className="h-72 w-56 rounded-3xl border-2 border-white/95"
                style={{ borderStyle: "dashed" }}
              />
              <ThemedText variant="body" className="mt-4 text-white">
                Place garment flat
              </ThemedText>
            </View>

            <View className="items-center pb-4">
              <Pressable
                className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20"
                onPress={() => void handleTakePhoto()}
                accessibilityRole="button"
                accessibilityLabel="Capture garment photo"
                disabled={isTakingPhoto}
              >
                <View className="h-12 w-12 rounded-full bg-white" />
              </Pressable>

              <Pressable
                className="mt-4 rounded-full bg-black/40 px-4 py-2"
                onPress={() => void handleSelectFromGallery()}
                accessibilityRole="button"
                accessibilityLabel="Choose from gallery"
              >
                <ThemedText variant="caption" className="text-white">
                  Choose from gallery
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  if (state.step === "success") {
    return (
      <AddSuccessState
        onAddAnother={() => dispatch({ type: "ADD_ANOTHER" })}
        onBrowseWardrobe={() => router.push(WARDROBE_ROUTE as Href)}
      />
    );
  }

  if (state.step === "previewing" || state.step === "uploading") {
    return (
      <AddPreviewState
        imageUri={state.imageUri}
        selectedCategory={selectedCategory}
        unsupportedCategories={unsupportedCategories}
        onSelectCategory={(category) => {
          if (isGarmentCategory(category)) {
            setSelectedCategory(category);
          }
        }}
        onSave={handleSave}
        onRetake={() => dispatch({ type: "RETAKE" })}
        isSaving={uploadMutation.isPending}
      />
    );
  }

  return (
    <AddIdleState
      showActionSheet={showActionSheet}
      onOpenActionSheet={() => setShowActionSheet(true)}
      onCloseActionSheet={() => setShowActionSheet(false)}
      onCapture={handleCapture}
    />
  );
}

interface AddSuccessStateProps {
  onAddAnother: () => void;
  onBrowseWardrobe: () => void;
}

function AddSuccessState({
  onAddAnother,
  onBrowseWardrobe,
}: AddSuccessStateProps) {
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
            onPress={onAddAnother}
          />
          <Pressable
            className="items-center justify-center py-3"
            accessibilityRole="button"
            accessibilityLabel="Browse wardrobe"
            onPress={onBrowseWardrobe}
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

interface AddPreviewStateProps {
  imageUri: string;
  selectedCategory: GarmentCategory;
  unsupportedCategories: readonly string[];
  onSelectCategory: (category: string) => void;
  onSave: () => void;
  onRetake: () => void;
  isSaving: boolean;
}

function AddPreviewState({
  imageUri,
  selectedCategory,
  unsupportedCategories,
  onSelectCategory,
  onSave,
  onRetake,
  isSaving,
}: AddPreviewStateProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 p-6">
        <ThemedText variant="heading" className="mb-4 text-center">
          Preview & Categorize
        </ThemedText>

        <View className="mb-6 flex-1 items-center justify-center">
          <View
            className="aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-white"
            accessibilityRole="image"
            accessibilityLabel="Garment photo preview"
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
            />
          </View>
        </View>

        <View className="mb-6">
          <ThemedText variant="caption" className="mb-2 text-text-secondary">
            Select Category
          </ThemedText>
          <CategoryPills
            categories={GARMENT_CATEGORIES}
            selected={selectedCategory}
            onSelect={onSelectCategory}
            unsupportedCategories={unsupportedCategories}
          />
        </View>

        <View className="gap-3">
          <Button
            label="Save to Wardrobe"
            variant="primary"
            onPress={onSave}
            isLoading={isSaving}
            disabled={isSaving}
          />
          <Button
            label="Retake"
            variant="secondary"
            onPress={onRetake}
            disabled={isSaving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

interface AddIdleStateProps {
  showActionSheet: boolean;
  onOpenActionSheet: () => void;
  onCloseActionSheet: () => void;
  onCapture: (source: "camera" | "gallery") => Promise<void>;
}

function AddIdleState({
  showActionSheet,
  onOpenActionSheet,
  onCloseActionSheet,
  onCapture,
}: AddIdleStateProps) {
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

        <View className="mb-6 w-full rounded-xl bg-surface p-4">
          <ThemedText
            variant="caption"
            className="mb-1 font-semibold text-text-primary"
          >
            Tips for best results
          </ThemedText>
          <ThemedText variant="caption" className="text-text-secondary">
            • Place garment flat on a plain surface{"\n"}• Use good, even
            lighting{"\n"}• Avoid wrinkles and shadows{"\n"}• Capture the full
            garment in frame
          </ThemedText>
        </View>

        <View className="w-full gap-3">
          <Button
            label="Add Garment"
            variant="primary"
            onPress={onOpenActionSheet}
          />
        </View>

        <ActionSheet
          isOpen={showActionSheet}
          onClose={onCloseActionSheet}
          items={[
            {
              label: "Take Photo",
              icon: (
                <Camera
                  size={20}
                  color={wearbloomTheme.colors["text-primary"]}
                />
              ),
              onPress: () => void onCapture("camera"),
            },
            {
              label: "Import from Gallery",
              icon: (
                <ImageIcon
                  size={20}
                  color={wearbloomTheme.colors["text-primary"]}
                />
              ),
              onPress: () => void onCapture("gallery"),
            },
          ]}
        />
      </View>
    </SafeAreaView>
  );
}
