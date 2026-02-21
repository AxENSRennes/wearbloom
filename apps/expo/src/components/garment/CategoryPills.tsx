import type { LayoutRectangle } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

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
  const scrollViewRef = useRef<ScrollView>(null);
  const [pillLayouts, setPillLayouts] = useState<Map<string, LayoutRectangle>>(
    () => new Map(),
  );
  const [containerWidth, setContainerWidth] = useState(0);

  const unsupportedCategorySet = useMemo(
    () => new Set(unsupportedCategories ?? []),
    [unsupportedCategories],
  );

  const handlePillLayout = useCallback(
    (category: string, layout: LayoutRectangle) => {
      setPillLayouts((prev) => {
        const next = new Map(prev);
        next.set(category, layout);
        return next;
      });
    },
    [],
  );

  // Auto-scroll to center the selected pill
  useEffect(() => {
    if (containerWidth === 0) return;
    const layout = pillLayouts.get(selected);
    if (!layout) return;

    const pillCenter = layout.x + layout.width / 2;
    const targetOffset = Math.max(0, pillCenter - containerWidth / 2);

    scrollViewRef.current?.scrollTo({ x: targetOffset, animated: true });
  }, [selected, pillLayouts, containerWidth]);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {categories.map((category) => {
        const isActive = category === selected;
        const isUnsupported = unsupportedCategorySet.has(category);

        return (
          <View
            key={category}
            onLayout={(e) => handlePillLayout(category, e.nativeEvent.layout)}
          >
            <Pressable
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
          </View>
        );
      })}
    </ScrollView>
  );
}
