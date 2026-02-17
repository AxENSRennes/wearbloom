import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useMutation } from "@tanstack/react-query";

import { Button, showToast, Spinner, ThemedText } from "@acme/ui";

import { STOCK_BODY_PHOTO } from "~/constants/stockAssets";
import { mockRequestRender } from "~/services/mockRenderService";
import { authClient } from "~/utils/auth";

export interface StepSeeTheMagicProps {
  onCreateAccount: () => void;
  onTryAnother: () => void;
  bodyPhotoUri?: string;
  garmentUri?: string;
}

const PROGRESS_TEXTS = [
  { text: "Creating your look...", threshold: 0 },
  { text: "Almost there...", threshold: 7000 },
  { text: "Taking a bit longer...", threshold: 10000 },
] as const;

export function StepSeeTheMagic({
  onCreateAccount,
  onTryAnother,
  bodyPhotoUri,
  garmentUri,
}: StepSeeTheMagicProps): ReactElement {
  const [progressText, setProgressText] = useState<string>(
    PROGRESS_TEXTS[0].text,
  );
  const startTimeRef = useRef(Date.now());
  const reducedMotion = useReducedMotion();

  // Pulsing scale animation
  const scale = useSharedValue(1);
  // Cross-fade: result image fades in on top of the body photo
  const resultOpacity = useSharedValue(0);
  // Shimmer sweep during loading
  const shimmerTranslate = useSharedValue(-1);

  // Auth + render mutation (H-1: TanStack Query, H-2: proper auth error handling)
  const renderMutation = useMutation({
    mutationFn: async () => {
      const authResult = await authClient.signIn.anonymous();
      if (authResult.error) {
        throw new Error(authResult.error.message ?? "Anonymous sign-in failed");
      }
      return mockRequestRender(
        bodyPhotoUri ?? "stock-body-01",
        garmentUri ?? "stock-garment",
      );
    },
    onSuccess: () => {
      if (!reducedMotion) {
        resultOpacity.value = withTiming(1, { duration: 500 });
      } else {
        resultOpacity.value = 1;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: () => {
      showToast({
        message: "Something went wrong. Try again.",
        variant: "error",
      });
    },
  });

  // Derive loading/result state from mutation
  const isRendering = !renderMutation.data && !renderMutation.isError;
  const resultUri = renderMutation.data?.resultUri ?? null;

  // Trigger on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
    renderMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulsing scale animation
  useEffect(() => {
    if (!reducedMotion && isRendering) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1000 }),
          withTiming(1, { duration: 1000 }),
        ),
        -1,
        true,
      );
    }
    return () => {
      scale.value = 1;
    };
  }, [scale, reducedMotion, isRendering]);

  // Shimmer animation loop
  useEffect(() => {
    if (!reducedMotion && isRendering) {
      shimmerTranslate.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false,
      );
    }
    return () => {
      shimmerTranslate.value = -1;
    };
  }, [shimmerTranslate, reducedMotion, isRendering]);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const resultImageStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value * 280 }],
  }));

  // Progress text updates
  useEffect(() => {
    if (!isRendering) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentText = [...PROGRESS_TEXTS]
        .reverse()
        .find((p) => elapsed >= p.threshold);
      if (currentText) {
        setProgressText(currentText.text);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRendering]);

  const handleCreateAccount = useCallback(() => {
    onCreateAccount();
  }, [onCreateAccount]);

  const handleTryAnother = useCallback(() => {
    onTryAnother();
  }, [onTryAnother]);

  return (
    <SafeAreaView className="flex-1" edges={["bottom"]}>
      <View className="flex-1 items-center px-6 pt-4">
        {/* Render result / loading preview with cross-fade */}
        <View className="my-6 flex-1 items-center justify-center">
          <View className="items-center">
            {/* Base layer: body photo preview (fades out via cross-fade) */}
            <View
              style={{ width: 280, height: 420, overflow: "hidden" }}
              className="rounded-xl"
            >
              {reducedMotion ? (
                <>
                  {isRendering ? (
                    <>
                      <Image
                        source={bodyPhotoUri ?? STOCK_BODY_PHOTO}
                        style={{ width: 280, height: 420 }}
                        contentFit="cover"
                        accessibilityLabel="Body photo preview"
                      />
                      <Spinner />
                    </>
                  ) : (
                    <Image
                      source={resultUri ?? bodyPhotoUri ?? STOCK_BODY_PHOTO}
                      style={{ width: 280, height: 420 }}
                      contentFit="cover"
                      accessibilityLabel="Virtual try-on result"
                    />
                  )}
                </>
              ) : (
                <>
                  {/* Loading: pulsing body photo */}
                  <Animated.View style={animatedImageStyle}>
                    <Image
                      source={bodyPhotoUri ?? STOCK_BODY_PHOTO}
                      style={{ width: 280, height: 420 }}
                      contentFit="cover"
                      accessibilityLabel="Body photo preview with loading animation"
                    />
                  </Animated.View>

                  {/* Shimmer overlay — visible only during loading */}
                  {isRendering && (
                    <Animated.View
                      style={[
                        {
                          position: "absolute",
                          top: 0,
                          width: "60%",
                          height: "100%",
                          backgroundColor: "rgba(255,255,255,0.15)",
                          borderRadius: 12,
                        },
                        shimmerStyle,
                      ]}
                    />
                  )}

                  {/* Result overlay: fades in on top */}
                  {resultUri != null && (
                    <Animated.View
                      style={[
                        {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                        },
                        resultImageStyle,
                      ]}
                    >
                      <Image
                        source={resultUri}
                        style={{ width: 280, height: 420 }}
                        contentFit="cover"
                        accessibilityLabel="Virtual try-on result"
                      />
                    </Animated.View>
                  )}
                </>
              )}
            </View>

            {/* Progress text — visible only during loading */}
            {isRendering && (
              <ThemedText
                variant="caption"
                className="mt-4 text-text-secondary"
              >
                {progressText}
              </ThemedText>
            )}
          </View>
        </View>

        {/* CTAs — visible after render completes */}
        {!isRendering && (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(200)}
            className="w-full gap-3 pb-4"
          >
            <Button
              label="Create Free Account"
              variant="primary"
              onPress={handleCreateAccount}
            />
            <Button
              label="Try another combination"
              variant="ghost"
              onPress={handleTryAnother}
            />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}
