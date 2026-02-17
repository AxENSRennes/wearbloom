import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { tva } from "@gluestack-ui/utils/nativewind-utils";

import { wearbloomTheme } from "./gluestack-config";

// ---------------------------------------------------------------------------
// Style definitions using tva (Tailwind Variant Authority)
// ---------------------------------------------------------------------------

const alertDialogButtonStyle = tva({
  base: "items-center justify-center rounded-xl px-6 w-full",
  variants: {
    variant: {
      destructive: "bg-error h-[52px] active:opacity-90",
      default: "bg-accent h-[52px] active:opacity-90",
      cancel: "bg-transparent h-[44px]",
    },
    isDisabled: {
      true: "opacity-40",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const alertDialogButtonTextStyle = tva({
  base: "font-semibold text-base text-center",
  variants: {
    variant: {
      destructive: "text-white",
      default: "text-white",
      cancel: "text-text-secondary",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

// ---------------------------------------------------------------------------
// AlertDialog component
// ---------------------------------------------------------------------------

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
}

function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: AlertDialogProps) {
  const buttonVariant = variant === "destructive" ? "destructive" : "default";

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={isLoading ? undefined : onClose}
      accessibilityViewIsModal
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        accessibilityRole="alert"
        onPress={isLoading ? undefined : onClose}
        disabled={isLoading}
      >
        <View
          className="mx-6 w-full max-w-sm rounded-2xl bg-background p-6"
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <Text className="mb-2 text-lg font-semibold text-text-primary">
            {title}
          </Text>

          {/* Body */}
          <Text className="mb-6 text-sm leading-5 text-text-secondary">
            {message}
          </Text>

          {/* Footer */}
          <View className="gap-3">
            {/* Confirm button */}
            <Pressable
              className={alertDialogButtonStyle({
                variant: buttonVariant,
                isDisabled: isLoading,
              })}
              onPress={onConfirm}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: isLoading, busy: isLoading }}
            >
              {isLoading ? (
                <ActivityIndicator color={wearbloomTheme.colors.background} size="small" />
              ) : (
                <Text className={alertDialogButtonTextStyle({ variant: buttonVariant })}>
                  {confirmLabel}
                </Text>
              )}
            </Pressable>

            {/* Cancel button */}
            <Pressable
              className={alertDialogButtonStyle({ variant: "cancel" })}
              onPress={onClose}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text className={alertDialogButtonTextStyle({ variant: "cancel" })}>
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

export { AlertDialog, alertDialogButtonStyle, alertDialogButtonTextStyle };
export type { AlertDialogProps };
