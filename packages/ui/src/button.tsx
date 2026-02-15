import React from "react";
import { Pressable, Text } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-600 rounded-lg px-6 py-3",
  secondary: "bg-neutral-200 rounded-lg px-6 py-3 border border-neutral-300",
  ghost: "bg-transparent px-6 py-3",
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: "text-white font-semibold text-base text-center",
  secondary: "text-neutral-800 font-semibold text-base text-center",
  ghost: "text-primary-600 font-semibold text-base text-center",
};

export function Button({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <Pressable
      className={`${variantStyles[variant]} ${disabled ? "opacity-50" : ""} ${className ?? ""}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={variantTextStyles[variant]}>{label}</Text>
    </Pressable>
  );
}
