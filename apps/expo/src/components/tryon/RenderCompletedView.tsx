import { Dimensions, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft } from "lucide-react-native";

import { SafeScreen } from "~/components/common/SafeScreen";
import { FeedbackButton } from "~/components/tryon/FeedbackButton";
import { getBaseUrl } from "~/utils/base-url";

interface RenderCompletedViewProps {
  personImageUrl: string | null | undefined;
  resultImageUrl: string | null | undefined;
  imageHeaders: { Cookie: string } | undefined;
  reducedMotion: boolean;
  feedbackDismissed: boolean;
  onFeedbackSubmit: (
    rating: "thumbs_up" | "thumbs_down",
    category?: string,
  ) => void;
  onFeedbackDismiss: () => void;
  isSubmittingFeedback: boolean;
}

export function RenderCompletedView({
  personImageUrl,
  resultImageUrl,
  imageHeaders,
  reducedMotion,
  feedbackDismissed,
  onFeedbackSubmit,
  onFeedbackDismiss,
  isSubmittingFeedback,
}: RenderCompletedViewProps) {
  const router = useRouter();

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

  const resultImageSource = resultImageUrl
    ? {
        uri: `${getBaseUrl()}${resultImageUrl}`,
        headers: imageHeaders,
      }
    : undefined;

  // Declarative entering animations (avoids useEffect for animation trigger)
  const resultEntering = reducedMotion ? undefined : FadeIn.duration(500);
  const uiEntering = reducedMotion ? undefined : FadeIn.duration(300);

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
              personImageUrl
                ? {
                    uri: `${getBaseUrl()}${personImageUrl}`,
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
          <Animated.View
            entering={resultEntering}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <Image
              source={resultImageSource}
              style={{ flex: 1 }}
              contentFit="cover"
              testID="render-result"
            />
          </Animated.View>

          {/* Floating back button — top-left */}
          <Animated.View entering={uiEntering}>
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
              entering={uiEntering}
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
              }}
            >
              <FeedbackButton
                onSubmit={onFeedbackSubmit}
                onDismiss={onFeedbackDismiss}
                isSubmitting={isSubmittingFeedback}
              />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
    </SafeScreen>
  );
}
