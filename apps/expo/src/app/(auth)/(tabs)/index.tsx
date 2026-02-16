import { useCallback, useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, ThemedText } from "@acme/ui";

import type { CategoryFilter, GarmentCategory } from "~/constants/categories";
import type { WardrobeItem } from "~/types/wardrobe";
import { trpc } from "~/utils/api";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { EmptyState } from "~/components/common/EmptyState";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { SkeletonGrid } from "~/components/garment/SkeletonGrid";
import { ALL_CATEGORIES } from "~/constants/categories";
import { getStockGarmentsByCategory } from "~/constants/stockGarments";

const GUTTER = 2;
const NUM_COLUMNS = 2;
const { width: screenWidth } = Dimensions.get("window");
const COLUMN_WIDTH = (screenWidth - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ITEM_HEIGHT = Math.round(COLUMN_WIDTH * 1.2);
const CATEGORY_PILLS_HEIGHT = 60;

export default function WardrobeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const queryClient = useQueryClient();

  const { data: garments, isLoading, isFetching, isError, error } = useQuery(
    trpc.garment.list.queryOptions(
      selectedCategory === "all" ? undefined : { category: selectedCategory as GarmentCategory },
    ),
  );

  const handleCategorySelect = useCallback(
    (category: string) => setSelectedCategory(category as CategoryFilter),
    [],
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
  }, [queryClient]);

  const wardrobeItems: WardrobeItem[] = useMemo(() => {
    const personal: WardrobeItem[] = (garments ?? []).map((g) => ({
      ...g,
      isStock: false as const,
    }));
    return [...personal, ...getStockGarmentsByCategory(selectedCategory)];
  }, [garments, selectedCategory]);

  const renderGarment = useCallback(
    ({ item }: { item: WardrobeItem }) => (
      <GarmentCard
        garment={item}
        onPress={() => {
          // Story 3.1 will implement garment detail bottom sheet
        }}
        columnWidth={COLUMN_WIDTH}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: WardrobeItem) => item.id, []);

  const emptyComponent = useMemo(() => {
    if (isLoading) return null;
    // Stock garments ensure "all" category is never truly empty
    return (
      <EmptyState
        headline="Nothing here yet"
        subtext={`Add a ${selectedCategory}`}
      />
    );
  }, [isLoading, selectedCategory]);

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-1 items-center justify-center p-4">
          <ThemedText variant="heading">Something went wrong</ThemedText>
          <ThemedText variant="body" className="mt-2 text-center text-text-secondary">
            We couldn't load your wardrobe. Please check your connection and try again.
          </ThemedText>
          <View className="mt-6">
            <Button variant="secondary" label="Try again" onPress={handleRefresh} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Sticky CategoryPills header */}
      <View className="absolute top-0 right-0 left-0 z-10 bg-white/90 px-4 py-2">
        <CategoryPills
          categories={ALL_CATEGORIES}
          selected={selectedCategory}
          onSelect={handleCategorySelect}
        />
      </View>

      {isLoading ? (
        <View style={{ paddingTop: CATEGORY_PILLS_HEIGHT }}>
          <SkeletonGrid columnWidth={COLUMN_WIDTH} />
        </View>
      ) : (
        <LegendList
          data={wardrobeItems}
          renderItem={renderGarment}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          estimatedItemSize={ITEM_HEIGHT}
          recycleItems
          refreshing={isFetching}
          onRefresh={handleRefresh}
          contentContainerStyle={{ paddingTop: CATEGORY_PILLS_HEIGHT }}
          columnWrapperStyle={{ gap: GUTTER }}
          ListEmptyComponent={emptyComponent}
        />
      )}
    </SafeAreaView>
  );
}
