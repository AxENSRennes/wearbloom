import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";

import type { WardrobeItem } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

interface GarmentCardProps {
  garment: WardrobeItem;
  onPress: () => void;
  columnWidth: number;
}

const PLACEHOLDER_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export function GarmentCard({ garment, onPress, columnWidth }: GarmentCardProps) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (reducedMotion) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const itemHeight = Math.round(columnWidth * 1.2);

  const imageSource = isStockGarment(garment)
    ? garment.imageSource
    : {
        uri: `${getBaseUrl()}/api/images/${garment.id}`,
        headers: (() => {
          const cookies = authClient.getCookie();
          return cookies ? { Cookie: cookies } : undefined;
        })(),
      };

  const label = isStockGarment(garment)
    ? `stock ${garment.category} garment`
    : `${garment.category} garment`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityHint="Double tap to view details"
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={imageSource}
          contentFit="cover"
          recyclingKey={garment.id}
          placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
          transition={200}
          style={{ width: columnWidth, height: itemHeight }}
        />
      </Animated.View>
    </Pressable>
  );
}
