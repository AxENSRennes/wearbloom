import { useCallback, useRef, useState } from "react";
import {
  
  LayoutAnimation,
  Pressable,
  ScrollView,
  Text
} from "react-native";
import type {LayoutChangeEvent} from "react-native";

import { cn } from "@acme/ui";

interface CategoryPillsProps {
  categories: readonly string[];
  selected: string;
  onSelect: (category: string) => void;
  unsupportedCategories?: readonly string[];
}

interface PillLayout {
  x: number;
  width: number;
}

export function CategoryPills({
  categories,
  selected,
  onSelect,
  unsupportedCategories,
}: CategoryPillsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const pillLayouts = useRef<Map<number, PillLayout>>(new Map());
  const [scrollViewWidth, setScrollViewWidth] = useState(0);

  const handleSelect = useCallback(
    (category: string, index: number) => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(
          150,
          LayoutAnimation.Types.easeInEaseOut,
          LayoutAnimation.Properties.opacity,
        ),
      );
      onSelect(category);
      const layout = pillLayouts.current.get(index);
      if (layout && scrollViewWidth > 0) {
        // Center the pill in the scroll view
        const targetX = layout.x - scrollViewWidth / 2 + layout.width / 2;
        scrollRef.current?.scrollTo({
          x: Math.max(0, targetX),
          animated: true,
        });
      }
    },
    [onSelect, scrollViewWidth],
  );

  const handlePillLayout = useCallback(
    (index: number, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      pillLayouts.current.set(index, { x, width });
    },
    [],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
      onLayout={(e) => setScrollViewWidth(e.nativeEvent.layout.width)}
    >
      {categories.map((category, index) => {
        const isActive = category === selected;
        const isUnsupported = unsupportedCategories?.includes(category) ?? false;
        return (
          <Pressable
            key={category}
            onPress={() => handleSelect(category, index)}
            onLayout={(e) => handlePillLayout(index, e)}
            accessibilityRole="button"
            accessibilityLabel={isUnsupported ? `${category}, try-on not available` : category}
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
            {isUnsupported && (
              <Text className={cn("text-[9px]", isActive ? "text-white/70" : "text-text-tertiary")}>
                No try-on
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
