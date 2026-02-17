import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

interface SkeletonGridProps {
  columnWidth: number;
}

const SKELETON_COUNT = 6;
const NUM_COLUMNS = 2;

export function SkeletonGrid({ columnWidth }: SkeletonGridProps) {
  const itemHeight = Math.round(columnWidth * 1.2);
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.5 : opacity.value,
  }));

  const rows = Array.from({ length: SKELETON_COUNT / NUM_COLUMNS }, (_, rowIndex) => rowIndex);

  return (
    <View className="flex-1">
      {rows.map((rowIndex) => (
        <View
          key={rowIndex}
          data-testid="skeleton-row"
          className="flex-row"
          style={{ gap: 2 }}
        >
          {Array.from({ length: NUM_COLUMNS }, (_, colIndex) => (
            <Animated.View
              key={colIndex}
              data-testid="skeleton-item"
              style={[{ width: columnWidth, height: itemHeight }, animatedStyle]}
              className="bg-surface"
            />
          ))}
        </View>
      ))}
    </View>
  );
}
