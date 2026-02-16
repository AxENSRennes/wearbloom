import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";

import type { RouterOutputs } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

type Garment = RouterOutputs["garment"]["list"][number];

interface GarmentCardProps {
  garment: Garment;
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
  const cookies = authClient.getCookie();
  const imageUri = `${getBaseUrl()}/api/images/${garment.id}`;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessible={true}
      accessibilityLabel={`${garment.category} garment`}
      accessibilityRole="button"
      accessibilityHint="Double tap to view details"
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={{
            uri: imageUri,
            headers: cookies ? { Cookie: cookies } : undefined,
          }}
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
