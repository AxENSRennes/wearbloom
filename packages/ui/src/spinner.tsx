import type { ActivityIndicatorProps } from "react-native";
import { ActivityIndicator } from "react-native";

import { wearbloomTheme } from "./gluestack-config";

interface SpinnerProps extends Omit<ActivityIndicatorProps, "color"> {
  color?: string;
}

export function Spinner({ color = wearbloomTheme.colors.accent, size = "small", ...props }: SpinnerProps) {
  return <ActivityIndicator color={color} size={size} {...props} />;
}
