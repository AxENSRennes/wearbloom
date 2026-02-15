import React from "react";
import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";

interface SpinnerProps extends Omit<ActivityIndicatorProps, "color"> {
  color?: string;
}

export function Spinner({ color = "#1A1A1A", size = "small", ...props }: SpinnerProps) {
  return <ActivityIndicator color={color} size={size} {...props} />;
}
