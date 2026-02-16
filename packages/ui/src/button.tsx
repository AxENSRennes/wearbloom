import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";
import type { PressableProps, TextProps, ViewProps } from "react-native";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createButton } from "@gluestack-ui/core";
import { tva } from "@gluestack-ui/utils/nativewind-utils";

import { wearbloomTheme } from "./gluestack-config";

// ---------------------------------------------------------------------------
// Style definitions using Gluestack tva (Tailwind Variant Authority)
// ---------------------------------------------------------------------------

const buttonStyle = tva({
  base: "items-center justify-center rounded-xl px-6 w-full",
  variants: {
    variant: {
      primary: "bg-accent h-[52px] active:opacity-90",
      secondary:
        "bg-background border border-accent h-[52px] active:opacity-90",
      ghost: "bg-transparent h-[44px]",
    },
    isDisabled: {
      true: "opacity-40",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

const buttonTextStyle = tva({
  base: "font-semibold text-base text-center",
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-[#1A1A1A]",
      ghost: "text-text-secondary",
    },
  },
  defaultVariants: {
    variant: "primary",
  },
});

// ---------------------------------------------------------------------------
// Styled primitives passed to createButton
// ---------------------------------------------------------------------------

const StyledRoot = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  PressableProps & { className?: string }
>((props, ref) => <Pressable ref={ref} {...props} />);
StyledRoot.displayName = "StyledRoot";

const StyledText = React.forwardRef<
  React.ComponentRef<typeof Text>,
  TextProps & { className?: string }
>((props, ref) => <Text ref={ref} {...props} />);
StyledText.displayName = "StyledText";

const StyledGroup = React.forwardRef<
  React.ComponentRef<typeof View>,
  ViewProps & { className?: string }
>((props, ref) => <View ref={ref} {...props} />);
StyledGroup.displayName = "StyledGroup";

const StyledSpinner = React.forwardRef<
  React.ComponentRef<typeof ActivityIndicator>,
  React.ComponentProps<typeof ActivityIndicator> & { className?: string }
>((props, ref) => <ActivityIndicator ref={ref} {...props} />);
StyledSpinner.displayName = "StyledSpinner";

const StyledIcon = React.forwardRef<
  React.ComponentRef<typeof View>,
  ViewProps & { className?: string }
>((props, ref) => <View ref={ref} {...props} />);
StyledIcon.displayName = "StyledIcon";

// ---------------------------------------------------------------------------
// Create Button via Gluestack createButton
// ---------------------------------------------------------------------------

const GluestackButton = createButton({
  Root: StyledRoot,
  Text: StyledText,
  Group: StyledGroup,
  Spinner: StyledSpinner,
  Icon: StyledIcon,
});

// ---------------------------------------------------------------------------
// Public API  --  convenience wrapper that applies tva styles
// ---------------------------------------------------------------------------

type ButtonVariant = NonNullable<VariantProps<typeof buttonStyle>["variant"]>;

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

const SPINNER_COLORS: Record<ButtonVariant, string> = {
  primary: wearbloomTheme.colors.background,
  secondary: wearbloomTheme.colors.accent,
  ghost: wearbloomTheme.colors["text-secondary"],
};

export function Button({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  isLoading = false,
  className,
}: ButtonProps) {
  return (
    <GluestackButton
      className={buttonStyle({
        variant,
        isDisabled: disabled || isLoading,
        className,
      })}
      onPress={onPress}
      isDisabled={disabled || isLoading}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator color={SPINNER_COLORS[variant]} size="small" />
      ) : (
        <GluestackButton.Text className={buttonTextStyle({ variant })}>
          {label}
        </GluestackButton.Text>
      )}
    </GluestackButton>
  );
}

// Also export the raw Gluestack button for advanced usage
export { GluestackButton };
export { buttonStyle, buttonTextStyle, SPINNER_COLORS };
