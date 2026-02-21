import type { Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";

import { Button, showToast, ThemedText } from "@acme/ui";

import { SafeScreen } from "~/components/common/SafeScreen";
import { FeedbackButton } from "~/components/tryon/FeedbackButton";
import { RenderLoadingAnimation } from "~/components/tryon/RenderLoadingAnimation";
import { trpc } from "~/utils/api";
import { getAuthHeaders } from "~/utils/authHeaders";
import { getBaseUrl } from "~/utils/base-url";

const MAX_POLLS = 15;

export default function RenderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const pollCount = useRef(0);
  const mountTime = useRef(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const hapticFired = useRef(false);

  // Cross-fade animation
  const resultOpacity = useSharedValue(0);
  const uiOpacity = useSharedValue(0);

  const { data } = useQuery({
    ...trpc.tryon.getRenderStatus.queryOptions({ renderId: id }),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      if (pollCount.current >= MAX_POLLS) return false;
      pollCount.current++;
      return 2000;
    },
  });

  const requestRenderMutation = useMutation(
    trpc.tryon.requestRender.mutationOptions({
      onSuccess: (newData) => {
        router.replace(`/render/${newData.renderId}` as Href);
      },
    }),
  );

  const submitFeedbackMutation = useMutation(
    trpc.tryon.submitFeedback.mutationOptions({
      onSuccess: (result) => {
        if (result.creditRefunded) {
          showToast({
            message: "Thanks for feedback. Render not counted.",
            variant: "success",
          });
        } else {
          showToast({
            message: "Thanks for your feedback!",
            variant: "success",
          });
        }
      },
      onError: () => {
        showToast({
          message: "Couldn't submit feedback. Try again.",
          variant: "error",
        });
      },
    }),
  );

  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  const handleFeedbackSubmit = useCallback(
    (rating: "thumbs_up" | "thumbs_down", category?: string) => {
      submitFeedbackMutation.mutate({ renderId: id, rating, category });
    },
    [submitFeedbackMutation, id],
  );

  const status = data?.status ?? "pending";

  // Elapsed time tracker for loading animation
  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - mountTime.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Haptic feedback and cross-fade animation on status change
  useEffect(() => {
    if (hapticFired.current) return;

    if (status === "completed") {
      hapticFired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (reducedMotion) {
        resultOpacity.value = 1;
        uiOpacity.value = 1;
      } else {
        resultOpacity.value = withTiming(1, { duration: 500 });
        uiOpacity.value = withTiming(1, { duration: 300 });
      }
    } else if (status === "failed") {
      hapticFired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [status, reducedMotion, resultOpacity, uiOpacity]);

  const resultAnimatedStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  const uiAnimatedStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value,
  }));

  // Swipe-down dismiss gesture
  const translateY = useSharedValue(0);
  const dismissOpacity = useSharedValue(1);
  const screenHeight = Dimensions.get("window").height;

  const dismissModal = () => {
    router.back();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        dismissOpacity.value = 1 - event.translationY / (screenHeight * 0.5);
      }
    })
    .onEnd((event) => {
      if (event.velocityY > 500 || event.translationY > screenHeight * 0.25) {
        translateY.value = withSpring(screenHeight);
        dismissOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(dismissModal)();
      } else {
        translateY.value = withSpring(0);
        dismissOpacity.value = withSpring(1);
      }
    });

  const gestureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: dismissOpacity.value,
    flex: 1,
  }));

  // Auth headers for image loading
  const imageHeaders = getAuthHeaders();

  // --- LOADING STATE ---
  if (status === "pending" || status === "processing") {
    return (
      <SafeScreen className="bg-black">
        <StatusBar style="light" />
        <RenderLoadingAnimation
          personImageUrl={
            data?.personImageUrl ? `${getBaseUrl()}${data.personImageUrl}` : ""
          }
          garmentImageUrl={
            data?.garmentImageUrl
              ? `${getBaseUrl()}${data.garmentImageUrl}`
              : null
          }
          elapsedMs={elapsedMs}
          imageHeaders={imageHeaders}
        />
      </SafeScreen>
    );
  }

  // --- FAILED STATE ---
  if (status === "failed") {
    return (
      <SafeScreen
        className="bg-black"
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <StatusBar style="light" />
        <ThemedText
          variant="body"
          style={{ color: "white", textAlign: "center", marginBottom: 24 }}
        >
          This one didn't work. No render counted.
        </ThemedText>
        <Button
          variant="secondary"
          label="Try Again"
          onPress={() => {
            if (data?.garmentId) {
              requestRenderMutation.mutate({ garmentId: data.garmentId });
            }
          }}
          isLoading={requestRenderMutation.isPending}
        />
        <View style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            label="Back to Wardrobe"
            onPress={() => router.back()}
          />
        </View>
      </SafeScreen>
    );
  }

  // --- COMPLETED STATE ---
  const resultImageSource = data?.resultImageUrl
    ? {
        uri: `${getBaseUrl()}${data.resultImageUrl}`,
        headers: imageHeaders,
      }
    : undefined;

  return (
    <SafeScreen className="bg-black">
      <GestureDetector gesture={reducedMotion ? Gesture.Pan() : panGesture}>
        <Animated.View
          style={[
            { flex: 1, backgroundColor: "black" },
            reducedMotion ? undefined : gestureAnimatedStyle,
          ]}
        >
          <StatusBar style="light" />

          {/* Layer 1: Body photo (always visible) */}
          <Image
            source={
              data?.personImageUrl
                ? {
                    uri: `${getBaseUrl()}${data.personImageUrl}`,
                    headers: imageHeaders,
                  }
                : undefined
            }
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            contentFit="cover"
            testID="body-photo-layer"
          />

          {/* Layer 2: Render result (cross-fades in) */}
          <Animated.View style={resultAnimatedStyle}>
            <Image
              source={resultImageSource}
              style={{ flex: 1 }}
              contentFit="cover"
              testID="render-result"
            />
          </Animated.View>

          {/* Floating back button — top-left (touchable ~300ms before fully visible) */}
          <Animated.View style={uiAnimatedStyle}>
            <Pressable
              testID="back-button"
              onPress={() => router.back()}
              style={{
                position: "absolute",
                top: 8,
                left: 16,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.3)",
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <ArrowLeft size={20} color="white" />
            </Pressable>
          </Animated.View>

          {/* Floating feedback button — bottom-right */}
          {!feedbackDismissed && (
            <Animated.View
              style={[
                uiAnimatedStyle,
                {
                  position: "absolute",
                  bottom: 16,
                  right: 16,
                },
              ]}
            >
              <FeedbackButton
                onSubmit={handleFeedbackSubmit}
                onDismiss={() => setFeedbackDismissed(true)}
                isSubmitting={submitFeedbackMutation.isPending}
              />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
    </SafeScreen>
  );
}
