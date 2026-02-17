import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { Button, showToast, ThemedText } from "@acme/ui";

import type { GarmentCategory, StockGarment } from "~/constants/stockAssets";
import { STOCK_GARMENTS } from "~/constants/stockAssets";

// TODO(Epic-2): Add garment category picker when user photographs own garment
const DEFAULT_PHOTO_CATEGORY: GarmentCategory = "tops";

export interface StepPickGarmentProps {
  onGarmentSelected: (
    uri: string,
    category: GarmentCategory,
    isStock: boolean,
  ) => void;
}

const PRESS_SPRING_CONFIG = { damping: 15, stiffness: 150 };

function GarmentCard({
  garment,
  isSelected,
  onPress,
}: {
  garment: StockGarment;
  isSelected: boolean;
  onPress: () => void;
}) {
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value API
        pressScale.value = withSpring(0.97, PRESS_SPRING_CONFIG);
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared value API
        pressScale.value = withSpring(1, PRESS_SPRING_CONFIG);
      }}
      className="flex-1 p-1"
      accessibilityLabel={garment.label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Animated.View
        style={animatedStyle}
        className={`overflow-hidden rounded-xl ${isSelected ? "border-2 border-[#1A1A1A]" : ""}`}
      >
        <View style={{ aspectRatio: 1 / 1.2 }}>
          <Image
            source={garment.source}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            accessibilityLabel={garment.label}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function StepPickGarment({
  onGarmentSelected,
}: StepPickGarmentProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleGarmentPress = useCallback(
    (garment: StockGarment) => {
      setSelectedId(garment.id);
      onGarmentSelected(garment.id, garment.category, true);
    },
    [onGarmentSelected],
  );

  const handlePhotographOwn = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast({
        message: "Camera permission is required to take a photo.",
        variant: "error",
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onGarmentSelected(result.assets[0].uri, DEFAULT_PHOTO_CATEGORY, false);
    }
  }, [onGarmentSelected]);

  const renderItem = useCallback(
    ({ item }: { item: StockGarment }) => (
      <GarmentCard
        garment={item}
        isSelected={selectedId === item.id}
        onPress={() => handleGarmentPress(item)}
      />
    ),
    [selectedId, handleGarmentPress],
  );

  return (
    <SafeAreaView className="flex-1" edges={["bottom"]}>
      <View className="flex-1 px-6 pt-4">
        <ThemedText variant="display" className="text-center">
          Now, choose something to try
        </ThemedText>

        <FlatList
          data={STOCK_GARMENTS}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
          contentContainerStyle={{ gap: 8, paddingTop: 24, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        />

        <Button
          label="Or photograph your own"
          variant="ghost"
          onPress={handlePhotographOwn}
        />
      </View>
    </SafeAreaView>
  );
}
