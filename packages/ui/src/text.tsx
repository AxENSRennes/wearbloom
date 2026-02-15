import React from "react";
import { Text, type TextProps } from "react-native";
import { tva } from "@gluestack-ui/utils/nativewind-utils";
import type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

const themedTextStyle = tva({
  base: "text-[#1A1A1A]",
  variants: {
    variant: {
      display: "text-[28px] leading-[34px] font-normal",
      heading: "text-[22px] leading-[28px] font-normal",
      title: "text-[17px] leading-[22px] font-semibold",
      body: "text-[15px] leading-[22px] font-normal",
      caption: "text-[13px] leading-[18px] font-medium",
      small: "text-[11px] leading-[14px] font-semibold",
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

type ThemedTextVariant = NonNullable<
  VariantProps<typeof themedTextStyle>["variant"]
>;

const SERIF_VARIANTS = new Set<ThemedTextVariant>(["display", "heading"]);
const DM_SERIF_FONT_FAMILY = "DMSerifDisplay_400Regular";

interface ThemedTextProps extends TextProps {
  variant?: ThemedTextVariant;
  className?: string;
}

export function ThemedText({
  variant = "body",
  className,
  style,
  ...props
}: ThemedTextProps) {
  const isSerif = SERIF_VARIANTS.has(variant);

  return (
    <Text
      className={themedTextStyle({ variant, className })}
      maxFontSizeMultiplier={1.5}
      style={[isSerif ? { fontFamily: DM_SERIF_FONT_FAMILY } : undefined, style]}
      {...props}
    />
  );
}

export { themedTextStyle };
export type { ThemedTextProps, ThemedTextVariant };
