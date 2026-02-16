import type { ReactNode } from "react";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { tva } from "@gluestack-ui/utils/nativewind-utils";

const actionSheetItemStyle = tva({
  base: "w-full flex-row items-center justify-center px-4",
  variants: {
    isPressed: {
      true: "bg-surface",
    },
  },
});

interface ActionSheetItem {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
}

function ActionSheet({ isOpen, onClose, items }: ActionSheetProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        className="flex-1 justify-end bg-black/50"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View
          className="rounded-t-xl bg-background pb-8"
          onStartShouldSetResponder={() => true}
        >
          {/* Drag indicator */}
          <View className="items-center py-3">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>

          {/* Items */}
          {items.map((item) => (
            <Pressable
              key={item.label}
              className={actionSheetItemStyle({})}
              style={{ height: 52 }}
              onPress={() => {
                item.onPress();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              {item.icon ? (
                <View className="mr-3">{item.icon}</View>
              ) : null}
              <Text className="text-base font-medium text-text-primary">
                {item.label}
              </Text>
            </Pressable>
          ))}

          {/* Cancel */}
          <Pressable
            className="mx-4 mt-2 items-center justify-center rounded-xl"
            style={{ height: 44 }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text className="text-base font-medium text-text-secondary">
              Cancel
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export { ActionSheet };
export type { ActionSheetProps, ActionSheetItem };
