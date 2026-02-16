import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
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

export function FeedbackButton({
  onSubmit,
  onDismiss,
  isSubmitting,
}: FeedbackButtonProps) {
  const [state, setState] = useState<FeedbackState>("collapsed");
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  // Animation values
  const expandWidth = useSharedValue(44);
  const fadeOpacity = useSharedValue(1);

  const resetAutoHide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    autoHideTimer.current = setTimeout(() => {
      onDismiss();
    }, AUTO_HIDE_MS);
  }, [onDismiss]);

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
      expandWidth.value = 120;
    } else {
      expandWidth.value = withSpring(120, { damping: 15, stiffness: 300 });
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isSubmitting, state, resetAutoHide, reducedMotion, expandWidth]);

  const handleThumbsUp = useCallback(() => {
    if (isSubmitting) return;
    resetAutoHide();
    setState("confirmed");

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit("thumbs_up", undefined);

    confirmTimer.current = setTimeout(() => {
      onDismiss();
    }, CONFIRM_DISMISS_MS);
  }, [isSubmitting, resetAutoHide, onSubmit, onDismiss]);

  const handleThumbsDown = useCallback(() => {
    if (isSubmitting) return;
    resetAutoHide();
    setState("category_picker");

    if (reducedMotion) {
      expandWidth.value = 260;
    } else {
      expandWidth.value = withSpring(260, { damping: 15, stiffness: 300 });
    }
  }, [isSubmitting, resetAutoHide, reducedMotion, expandWidth]);

  const handleCategorySelect = useCallback(
    (category: string) => {
      if (isSubmitting) return;
      setState("confirmed");

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSubmit("thumbs_down", category);

      confirmTimer.current = setTimeout(() => {
        onDismiss();
      }, CONFIRM_DISMISS_MS);
    },
    [isSubmitting, onSubmit, onDismiss],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  // --- CONFIRMED STATE ---
  if (state === "confirmed") {
    return (
      <Animated.View style={reducedMotion ? undefined : animatedStyle}>
        <View
          testID="feedback-button"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.3)",
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
      </Animated.View>
    );
  }

  // --- CATEGORY PICKER STATE ---
  if (state === "category_picker") {
    return (
      <Animated.View style={reducedMotion ? undefined : animatedStyle}>
        <View
          testID="feedback-button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.3)",
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
      </Animated.View>
    );
  }

  // --- EXPANDED STATE ---
  if (state === "expanded") {
    return (
      <Animated.View style={reducedMotion ? undefined : animatedStyle}>
        <View
          testID="feedback-button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            paddingHorizontal: 16,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.3)",
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
      </Animated.View>
    );
  }

  // --- COLLAPSED STATE (default) ---
  return (
    <Animated.View style={reducedMotion ? undefined : animatedStyle}>
      <Pressable
        testID="feedback-button"
        onPress={handleExpand}
        disabled={isSubmitting}
        accessibilityLabel="Rate this render"
        accessibilityRole="button"
        accessibilityHint="Double tap to rate quality"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.3)",
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
    </Animated.View>
  );
}
