import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { cn } from "@acme/ui";

interface CategoryPillsProps {
  categories: readonly string[];
  selected: string;
  onSelect: (category: string) => void;
  unsupportedCategories?: readonly string[];
}

export function CategoryPills({
  categories,
  selected,
  onSelect,
  unsupportedCategories,
}: CategoryPillsProps) {
  const unsupportedCategorySet = useMemo(
    () => new Set(unsupportedCategories ?? []),
    [unsupportedCategories],
  );

  return (
    <View className="flex-row flex-wrap gap-2">
      {categories.map((category) => {
        const isActive = category === selected;
        const isUnsupported = unsupportedCategorySet.has(category);

        return (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            accessibilityRole="button"
            accessibilityLabel={
              isUnsupported ? `${category}, try-on not available` : category
            }
            accessibilityState={{ selected: isActive }}
            className={cn(
              "items-center justify-center rounded-full px-3 py-2",
              isActive ? "bg-text-primary" : "bg-surface",
            )}
            style={{ minHeight: 42 }}
          >
            <Text
              className={cn(
                "text-[13px] font-medium",
                isActive ? "text-white" : "text-text-secondary",
              )}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
            {isUnsupported && (
              <Text
                className={cn(
                  "text-[9px]",
                  isActive ? "text-white/70" : "text-text-tertiary",
                )}
              >
                No try-on
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
