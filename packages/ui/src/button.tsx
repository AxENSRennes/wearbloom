import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import { createButton } from "@gluestack-ui/core";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

// ---------------------------------------------------------------------------
// Style definitions using Gluestack tva (Tailwind Variant Authority)
// ---------------------------------------------------------------------------

const buttonStyle = tva({
  base: "items-center justify-center rounded-lg px-6 py-3",
  variants: {
    variant: {
      primary: "bg-primary-600 active:bg-primary-700",
      secondary:
        "bg-neutral-200 border border-neutral-300 active:bg-neutral-300",
      ghost: "bg-transparent active:bg-neutral-100",
    },
    isDisabled: {
      true: "opacity-50",
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
      secondary: "text-neutral-800",
      ghost: "text-primary-600",
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
  className?: string;
}

export function Button({
  label,
  variant = "primary",
  onPress,
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <GluestackButton
      className={buttonStyle({ variant, isDisabled: disabled, className })}
      onPress={onPress}
      isDisabled={disabled}
    >
      <GluestackButton.Text
        className={buttonTextStyle({ variant })}
      >
        {label}
      </GluestackButton.Text>
    </GluestackButton>
  );
}

// Also export the raw Gluestack button for advanced usage
export { GluestackButton };
export { buttonStyle, buttonTextStyle };
