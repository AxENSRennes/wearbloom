import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react-native";

import { ThemedText } from "@acme/ui";

type FeedbackState =
  | "collapsed"
  | "expanded"
  | "category_picker"
  | "confirmed"
  | "dismissed";

interface FeedbackButtonProps {
  onSubmit: (
    rating: "thumbs_up" | "thumbs_down",
    category?: string,
  ) => void;
  onDismiss: () => void;
  isSubmitting: boolean;
}

const CATEGORIES = [
  { key: "wrong_fit", label: "Wrong fit" },
  { key: "artifacts", label: "Artifacts" },
  { key: "wrong_garment", label: "Wrong garment" },
  { key: "other", label: "Other" },
] as const;

const AUTO_HIDE_MS = 10_000;
const CONFIRM_DISMISS_MS = 800;
const FADE_OUT_MS = 200;

const COLLAPSED_WIDTH = 44;
const EXPANDED_WIDTH = 120;
const CATEGORY_PICKER_WIDTH = 260;

export function FeedbackButton({
  onSubmit,
  onDismiss,
  isSubmitting,
}: FeedbackButtonProps) {
  const [state, setState] = useState<FeedbackState>("collapsed");
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  // Ref to avoid stale closure in reanimated worklet callbacks
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Animation values
  const expandWidth = useSharedValue(COLLAPSED_WIDTH);
  const fadeOpacity = useSharedValue(1);

  /** Animate fade-out then call onDismiss */
  const animateDismiss = useCallback(() => {
    if (reducedMotion) {
      onDismissRef.current();
      return;
    }

    fadeOpacity.value = withTiming(0, { duration: FADE_OUT_MS }, (finished) => {
      if (finished) {
        runOnJS(onDismissRef.current)();
      }
    });
  }, [reducedMotion, fadeOpacity]);

  const resetAutoHide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = setTimeout(() => {
      animateDismiss();
    }, AUTO_HIDE_MS);
  }, [animateDismiss]);

  // Start auto-hide timer on mount
  useEffect(() => {
    resetAutoHide();
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, [resetAutoHide]);

  const handleExpand = useCallback(() => {
    if (isSubmitting || state !== "collapsed") return;
    resetAutoHide();
    setState("expanded");

    if (reducedMotion) {
      expandWidth.value = EXPANDED_WIDTH;
    } else {
      expandWidth.value = withSpring(EXPANDED_WIDTH, { damping: 15, stiffness: 300 });
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isSubmitting, state, resetAutoHide, reducedMotion, expandWidth]);

  const handleThumbsUp = useCallback(() => {
    if (isSubmitting) return;
    resetAutoHide();
    setState("confirmed");

    // Collapse back to small size for confirmed state
    if (reducedMotion) {
      expandWidth.value = COLLAPSED_WIDTH;
    } else {
      expandWidth.value = withSpring(COLLAPSED_WIDTH, { damping: 15, stiffness: 300 });
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit("thumbs_up", undefined);

    confirmTimer.current = setTimeout(() => {
      animateDismiss();
    }, CONFIRM_DISMISS_MS);
  }, [isSubmitting, resetAutoHide, onSubmit, animateDismiss, reducedMotion, expandWidth]);

  const handleThumbsDown = useCallback(() => {
    if (isSubmitting) return;
    resetAutoHide();
    setState("category_picker");

    if (reducedMotion) {
      expandWidth.value = CATEGORY_PICKER_WIDTH;
    } else {
      expandWidth.value = withSpring(CATEGORY_PICKER_WIDTH, { damping: 15, stiffness: 300 });
    }
  }, [isSubmitting, resetAutoHide, reducedMotion, expandWidth]);

  const handleCategorySelect = useCallback(
    (category: string) => {
      if (isSubmitting) return;
      setState("confirmed");

      // Collapse back to small size for confirmed state
      if (reducedMotion) {
        expandWidth.value = COLLAPSED_WIDTH;
      } else {
        expandWidth.value = withSpring(COLLAPSED_WIDTH, { damping: 15, stiffness: 300 });
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSubmit("thumbs_down", category);

      confirmTimer.current = setTimeout(() => {
        animateDismiss();
      }, CONFIRM_DISMISS_MS);
    },
    [isSubmitting, onSubmit, animateDismiss, reducedMotion, expandWidth],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    width: expandWidth.value,
  }));

  // --- Render inner content based on state ---
  const renderContent = () => {
    if (state === "confirmed") {
      return (
        <View
          style={{
            width: COLLAPSED_WIDTH,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check
            size={20}
            color="white"
            testID="feedback-icon-confirmed"
          />
        </View>
      );
    }

    if (state === "category_picker") {
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 8,
            paddingVertical: 6,
          }}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              testID={`category-${cat.key}`}
              onPress={() => handleCategorySelect(cat.key)}
              disabled={isSubmitting}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            >
              <ThemedText
                variant="caption"
                style={{ color: "white", fontSize: 12 }}
              >
                {cat.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      );
    }

    if (state === "expanded") {
      return (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            paddingHorizontal: 16,
            height: 44,
          }}
        >
          <Pressable
            testID="feedback-thumbs-up"
            onPress={handleThumbsUp}
            disabled={isSubmitting}
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ThumbsUp size={20} color="white" />
          </Pressable>
          <Pressable
            testID="feedback-thumbs-down"
            onPress={handleThumbsDown}
            disabled={isSubmitting}
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ThumbsDown size={20} color="white" />
          </Pressable>
        </View>
      );
    }

    // Collapsed state (default)
    return (
      <Pressable
        onPress={handleExpand}
        disabled={isSubmitting}
        accessibilityLabel="Rate this render"
        accessibilityRole="button"
        accessibilityHint="Double tap to rate quality"
        style={{
          width: COLLAPSED_WIDTH,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          testID="feedback-icon-collapsed"
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle size={20} color="white" />
        </View>
      </Pressable>
    );
  };

  return (
    <Animated.View
      testID="feedback-button"
      style={[
        {
          height: 44,
          borderRadius: 22,
          // Note: backdrop-blur effect requires expo-blur (BlurView) which is not installed.
          // Using semi-transparent background as fallback.
          backgroundColor: "rgba(255,255,255,0.3)",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        reducedMotion ? { width: getStaticWidth(state) } : animatedStyle,
      ]}
    >
      {renderContent()}
    </Animated.View>
  );
}

/** Returns the target width for a given state without animation (reduced motion fallback). */
function getStaticWidth(state: FeedbackState): number {
  switch (state) {
    case "category_picker":
      return CATEGORY_PICKER_WIDTH;
    case "expanded":
      return EXPANDED_WIDTH;
    case "collapsed":
    case "confirmed":
    case "dismissed":
      return COLLAPSED_WIDTH;
  }
}
