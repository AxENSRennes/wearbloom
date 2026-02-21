import { useCallback } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list";

import type { CategoryFilter } from "~/constants/categories";
import type { WardrobeItem } from "~/types/wardrobe";
import { EmptyState } from "~/components/common/EmptyState";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { SkeletonGrid } from "~/components/garment/SkeletonGrid";
import { useScrollFeedback } from "~/hooks/useScrollFeedback";

const GUTTER = 6;
const NUM_COLUMNS = 2;
const GRID_HORIZONTAL_PADDING = 8;
const LIST_BOTTOM_EXTRA_PADDING = 120;

interface CarouselPageProps {
  category: CategoryFilter;
  items: WardrobeItem[];
  isLoading: boolean;
  isFetching: boolean;
  isManualRefresh: boolean;
  onRefresh: () => void;
  onGarmentPress: (garment: WardrobeItem) => void;
  onGarmentLongPress: (garment: WardrobeItem) => void;
}

export function CarouselPage({
  category,
  items,
  isLoading,
  isFetching,
  isManualRefresh,
  onRefresh,
  onGarmentPress,
  onGarmentLongPress,
}: CarouselPageProps) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const availableWidth = Math.max(
    0,
    screenWidth - GRID_HORIZONTAL_PADDING * 2 - GUTTER * (NUM_COLUMNS - 1),
  );
  const columnWidth = availableWidth / NUM_COLUMNS;
  const itemHeight = Math.round(columnWidth * 1.2);
  const listContentBottomPadding = Math.max(
    LIST_BOTTOM_EXTRA_PADDING,
    insets.bottom + 88,
  );

  const { scrollProps } = useScrollFeedback({
    screen: "wardrobe-grid",
  });

  const renderGarment = useCallback(
    ({ item }: { item: WardrobeItem }) => (
      <GarmentCard
        garment={item}
        onPress={() => onGarmentPress(item)}
        onLongPress={() => onGarmentLongPress(item)}
        columnWidth={columnWidth}
      />
    ),
    [columnWidth, onGarmentPress, onGarmentLongPress],
  );

  const keyExtractor = useCallback((item: WardrobeItem) => item.id, []);

  const emptyComponent = isLoading ? (
    <View className="pt-3">
      <SkeletonGrid columnWidth={columnWidth} />
    </View>
  ) : (
    <EmptyState headline="Nothing here yet" subtext={`Add a ${category}`} />
  );

  return (
    <LegendList
      data={isLoading ? [] : items}
      renderItem={renderGarment}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      style={{ flex: 1 }}
      estimatedItemSize={itemHeight}
      recycleItems
      bounces
      alwaysBounceVertical
      overScrollMode="always"
      showsVerticalScrollIndicator={false}
      refreshing={isManualRefresh && isFetching}
      onRefresh={onRefresh}
      contentContainerStyle={{
        paddingHorizontal: GRID_HORIZONTAL_PADDING,
        paddingBottom: listContentBottomPadding,
      }}
      columnWrapperStyle={{ gap: GUTTER }}
      ListEmptyComponent={emptyComponent}
      scrollEventThrottle={scrollProps.scrollEventThrottle}
      onLayout={scrollProps.onLayout}
      onContentSizeChange={scrollProps.onContentSizeChange}
      onScroll={scrollProps.onScroll}
      onScrollBeginDrag={scrollProps.onScrollBeginDrag}
      onScrollEndDrag={scrollProps.onScrollEndDrag}
    />
  );
}
