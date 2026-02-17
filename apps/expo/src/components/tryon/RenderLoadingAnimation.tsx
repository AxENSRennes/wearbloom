import { ActivityIndicator, Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useEffect } from "react";

import { ThemedText } from "@acme/ui";

interface RenderLoadingAnimationProps {
  personImageUrl: string;
  garmentImageUrl: string | null;
  elapsedMs: number;
  imageHeaders?: Record<string, string>;
}

function getProgressText(elapsedMs: number): string {
  if (elapsedMs >= 10000) return "Taking a bit longer...";
  if (elapsedMs >= 7000) return "Almost there...";
  return "Creating your look...";
}

export function RenderLoadingAnimation({
  personImageUrl,
  garmentImageUrl,
  elapsedMs,
  imageHeaders,
}: RenderLoadingAnimationProps) {
  const reducedMotion = useReducedMotion();
  const screenWidth = Dimensions.get("window").width;
  const shimmerTranslateX = useSharedValue(-screenWidth);
  const pulseScale = useSharedValue(1);
  const thumbnailOpacity = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;

    shimmerTranslateX.value = withRepeat(
      withTiming(screenWidth, {
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
    );

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1.0, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
    );
  }, [shimmerTranslateX, pulseScale, reducedMotion, screenWidth]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    flex: 1,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslateX.value }],
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    width: 150,
    backgroundColor: "rgba(255,255,255,0.15)",
  }));

  const showGarmentThumbnail =
    elapsedMs >= 3000 && garmentImageUrl !== null;

  useEffect(() => {
    if (showGarmentThumbnail && !reducedMotion) {
      thumbnailOpacity.value = withTiming(1, { duration: 300 });
    } else if (showGarmentThumbnail && reducedMotion) {
      thumbnailOpacity.value = 1;
    }
  }, [showGarmentThumbnail, reducedMotion, thumbnailOpacity]);

  const thumbnailAnimatedStyle = useAnimatedStyle(() => ({
    opacity: thumbnailOpacity.value,
  }));

  if (reducedMotion) {
    return (
      <View className="flex-1 bg-black">
        <Image
          source={{ uri: personImageUrl, headers: imageHeaders }}
          className="flex-1"
          contentFit="cover"
          testID="body-photo"
        />
        {showGarmentThumbnail && (
          <View
            testID="garment-thumbnail"
            className="absolute top-20 right-5 w-16 h-16 rounded-xl overflow-hidden"
          >
            <Image
              source={{ uri: garmentImageUrl, headers: imageHeaders }}
              className="w-16 h-16"
              contentFit="cover"
            />
          </View>
        )}
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color="white" />
          <ThemedText
            variant="body"
            className="text-white/70 text-[13px] mt-3"
          >
            {getProgressText(elapsedMs)}
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Base layer: body photo with pulse animation */}
      <Animated.View style={pulseStyle}>
        <Image
          source={{ uri: personImageUrl, headers: imageHeaders }}
          className="flex-1"
          contentFit="cover"
          testID="body-photo"
        />
      </Animated.View>

      {/* Shimmer overlay */}
      <View className="absolute inset-0 overflow-hidden">
        <Animated.View style={shimmerStyle} />
      </View>

      {/* Garment thumbnail — appears at 3s with fade-in */}
      {showGarmentThumbnail && (
        <Animated.View
          testID="garment-thumbnail"
          style={[
            {
              position: "absolute",
              top: 80,
              right: 20,
              width: 64,
              height: 64,
              borderRadius: 12,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
            },
            thumbnailAnimatedStyle,
          ]}
        >
          <Image
            source={{ uri: garmentImageUrl, headers: imageHeaders }}
            className="w-16 h-16"
            contentFit="cover"
          />
        </Animated.View>
      )}

      {/* Progress text — bottom center */}
      <View className="absolute bottom-20 inset-x-0 items-center">
        <ThemedText
          variant="body"
          className="text-white/70 text-[13px]"
        >
          {getProgressText(elapsedMs)}
        </ThemedText>
      </View>
    </View>
  );
}
