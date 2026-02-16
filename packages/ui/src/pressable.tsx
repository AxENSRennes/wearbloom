import type { PressableProps } from "react-native";
import React from "react";
import { Pressable as RNPressable } from "react-native";

export interface ThemedPressableProps extends PressableProps {
  className?: string;
}

export const ThemedPressable = React.forwardRef<
  React.ComponentRef<typeof RNPressable>,
  ThemedPressableProps
>(({ accessible = true, ...props }, ref) => (
  <RNPressable ref={ref} accessible={accessible} {...props} />
));
ThemedPressable.displayName = "ThemedPressable";
