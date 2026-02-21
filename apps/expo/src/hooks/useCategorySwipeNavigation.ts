import { useCallback, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { runOnJS } from "react-native-reanimated";

const SWIPE_DISTANCE_THRESHOLD = 42;
const SWIPE_VELOCITY_THRESHOLD = 700;
const SWIPE_INTENT_RATIO = 1.1;

export type CategorySwipeSource =
  | "tap"
  | "swipe-left"
  | "swipe-right";

interface UseCategorySwipeNavigationOptions<TCategory extends string> {
  categories: readonly TCategory[];
  selectedCategory: TCategory;
  onCategorySelect: (
    category: TCategory,
    source: CategorySwipeSource,
  ) => void;
}

function isSwipeActionable(
  translationX: number,
  translationY: number,
  velocityX: number,
) {
  const horizontalDistance = Math.abs(translationX);
  const verticalDistance = Math.abs(translationY);
  const horizontalVelocity = Math.abs(velocityX);
  const hasHorizontalIntent =
    horizontalDistance > verticalDistance * SWIPE_INTENT_RATIO;
  const passedDistance = horizontalDistance >= SWIPE_DISTANCE_THRESHOLD;
  const passedVelocity = horizontalVelocity >= SWIPE_VELOCITY_THRESHOLD;
  return hasHorizontalIntent && (passedDistance || passedVelocity);
}

export function useCategorySwipeNavigation<TCategory extends string>({
  categories,
  selectedCategory,
  onCategorySelect,
}: UseCategorySwipeNavigationOptions<TCategory>) {
  const selectedIndex = useMemo(
    () => categories.indexOf(selectedCategory),
    [categories, selectedCategory],
  );

  const selectByIndex = useCallback(
    (index: number, source: CategorySwipeSource) => {
      if (index < 0 || index >= categories.length) return;
      const nextCategory = categories[index];
      if (!nextCategory || nextCategory === selectedCategory) return;
      if (source !== "tap") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onCategorySelect(nextCategory, source);
    },
    [categories, onCategorySelect, selectedCategory],
  );

  const selectFromTap = useCallback(
    (category: TCategory) => {
      onCategorySelect(category, "tap");
    },
    [onCategorySelect],
  );

  const goToPreviousCategory = useCallback(() => {
    if (selectedIndex < 0) return;
    selectByIndex(selectedIndex - 1, "swipe-right");
  }, [selectByIndex, selectedIndex]);

  const goToNextCategory = useCallback(() => {
    if (selectedIndex < 0) return;
    selectByIndex(selectedIndex + 1, "swipe-left");
  }, [selectByIndex, selectedIndex]);

  const swipeGesture = useMemo(
    () => {
      const panGesture = Gesture.Pan();
      if (
        "activeOffsetX" in panGesture &&
        typeof panGesture.activeOffsetX === "function"
      ) {
        panGesture.activeOffsetX([-22, 22]);
      }
      if (
        "failOffsetY" in panGesture &&
        typeof panGesture.failOffsetY === "function"
      ) {
        panGesture.failOffsetY([-14, 14]);
      }
      return panGesture.onEnd((event) => {
        if (
          !isSwipeActionable(
            event.translationX,
            event.translationY,
            event.velocityX,
          )
        ) {
          return;
        }
        if (event.translationX < 0) {
          runOnJS(goToNextCategory)();
          return;
        }
        runOnJS(goToPreviousCategory)();
      });
    },
    [goToNextCategory, goToPreviousCategory],
  );

  return {
    selectedIndex,
    selectFromTap,
    swipeGesture,
  };
}

export function shouldNavigateCategoryOnSwipe(
  translationX: number,
  translationY: number,
  velocityX: number,
) {
  return isSwipeActionable(translationX, translationY, velocityX);
}
