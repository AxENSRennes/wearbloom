import { useCallback, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { cn } from "@acme/ui";

interface CategoryPillsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

const PILL_WIDTH_ESTIMATE = 90;

export function CategoryPills({
  categories,
  selected,
  onSelect,
}: CategoryPillsProps) {
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = useCallback(
    (category: string, index: number) => {
      onSelect(category);
      scrollRef.current?.scrollTo({
        x: Math.max(0, index * PILL_WIDTH_ESTIMATE - 40),
        animated: true,
      });
    },
    [onSelect],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {categories.map((category, index) => {
        const isActive = category === selected;
        return (
          <Pressable
            key={category}
            onPress={() => handleSelect(category, index)}
            accessibilityRole="button"
            accessibilityLabel={category}
            accessibilityState={{ selected: isActive }}
            className={cn(
              "items-center justify-center rounded-full px-3 py-2",
              isActive ? "bg-text-primary" : "bg-surface",
            )}
            style={{ height: 44 }}
          >
            <Text
              className={cn(
                "text-[13px] font-medium",
                isActive ? "text-white" : "text-text-secondary",
              )}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
