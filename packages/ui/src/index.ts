// ---------------------------------------------------------------------------
// Gluestack UI v3 + NativeWind utilities
// ---------------------------------------------------------------------------

// cn: class-name merge utility (clsx + tailwind-merge) from Gluestack
export { cn } from "@gluestack-ui/utils/nativewind-utils";

// tva: Tailwind Variant Authority -- variant-driven className generation
export { tva } from "@gluestack-ui/utils/nativewind-utils";
export type { VariantProps } from "@gluestack-ui/utils/nativewind-utils";

// Style context helpers for compound components
export {
  withStyleContext,
  useStyleContext,
} from "@gluestack-ui/utils/nativewind-utils";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export {
  Button,
  GluestackButton,
  buttonStyle,
  buttonTextStyle,
} from "./button";

export { ThemedText, themedTextStyle } from "./text";
export type { ThemedTextProps, ThemedTextVariant } from "./text";

export { Spinner } from "./spinner";

export { ThemedPressable } from "./pressable";
export type { ThemedPressableProps } from "./pressable";

export { ToastProvider, showToast } from "./toast";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export { wearbloomTheme } from "./gluestack-config";
export type { WearbloomTheme } from "./gluestack-config";
