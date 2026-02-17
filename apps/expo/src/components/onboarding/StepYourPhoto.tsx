import type { ReactElement } from "react";
import type { ImageSourcePropType } from "react-native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { Button, showToast, ThemedText } from "@acme/ui";

import { STOCK_BODY_PHOTO } from "~/constants/stockAssets";

export interface StepYourPhotoProps {
  onPhotoSelected: (uri: string, isStock: boolean) => void;
}

export function StepYourPhoto({
  onPhotoSelected,
}: StepYourPhotoProps): ReactElement {
  const [previewSource, setPreviewSource] =
    useState<ImageSourcePropType>(STOCK_BODY_PHOTO);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [isUsingStock, setIsUsingStock] = useState(true);

  const handleUsePhoto = useCallback(() => {
    if (isUsingStock) {
      onPhotoSelected("stock-body-01", true);
    } else if (selectedUri) {
      onPhotoSelected(selectedUri, false);
    }
  }, [onPhotoSelected, selectedUri, isUsingStock]);

  const handleCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast({
        message: "Camera permission is required to take a photo.",
        variant: "error",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPreviewSource({ uri } as ImageSourcePropType);
      setSelectedUri(uri);
      setIsUsingStock(false);
      onPhotoSelected(uri, false);
    }
  }, [onPhotoSelected]);

  const handleGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({
        message: "Photo library permission is required.",
        variant: "error",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPreviewSource({ uri } as ImageSourcePropType);
      setSelectedUri(uri);
      setIsUsingStock(false);
      onPhotoSelected(uri, false);
    }
  }, [onPhotoSelected]);

  return (
    <SafeAreaView className="flex-1" edges={["bottom"]}>
      <View className="flex-1 items-center px-6 pt-4">
        <ThemedText variant="display" className="text-center">
          First, let&apos;s see you
        </ThemedText>

        <ThemedText
          variant="body"
          className="mt-2 text-center text-text-secondary"
        >
          Take a photo or use an example
        </ThemedText>

        {/* Stock body photo preview */}
        <View className="my-6 items-center">
          <Image
            source={previewSource}
            style={{ width: 225, height: 337 }}
            contentFit="cover"
            className="rounded-xl"
            accessibilityLabel="Body photo preview"
          />
        </View>

        {/* CTAs */}
        <View className="w-full gap-3">
          <Button
            label="Use this photo"
            variant="primary"
            onPress={handleUsePhoto}
          />
          <Button
            label="Take a photo"
            variant="secondary"
            onPress={handleCamera}
          />
          <Button
            label="Choose from gallery"
            variant="ghost"
            onPress={handleGallery}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
