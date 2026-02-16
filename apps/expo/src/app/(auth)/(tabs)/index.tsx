import { useCallback, useMemo, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, ThemedText } from "@acme/ui";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { EmptyState } from "~/components/common/EmptyState";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { SkeletonGrid } from "~/components/garment/SkeletonGrid";

type Garment = RouterOutputs["garment"]["list"][number];

/**
 * Garment categories — LOCAL COPY.
 * Source of truth: packages/db/src/schema.ts → GARMENT_CATEGORIES
 * Duplicated here because @acme/db is a server-only package (Drizzle/postgres deps)
 * and cannot be imported in Expo client code.
 * If categories change in schema.ts, update this array AND VALID_CATEGORIES in
 * packages/api/src/router/garment.ts.
 */
const GARMENT_CATEGORIES = ["tops", "bottoms", "dresses", "shoes", "outerwear"] as const;
const ALL_CATEGORIES = ["all", ...GARMENT_CATEGORIES] as const;

const GUTTER = 2;
const NUM_COLUMNS = 2;
const { width: screenWidth } = Dimensions.get("window");
const COLUMN_WIDTH = (screenWidth - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ITEM_HEIGHT = Math.round(COLUMN_WIDTH * 1.2);
const CATEGORY_PILLS_HEIGHT = 60;

export default function WardrobeScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: garments, isLoading, isFetching, isError, error } = useQuery(
    trpc.garment.list.queryOptions(
      selectedCategory === "all" ? undefined : { category: selectedCategory as (typeof GARMENT_CATEGORIES)[number] },
    ),
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
  }, [queryClient]);

  const renderGarment = useCallback(
    ({ item }: { item: Garment }) => (
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

  const keyExtractor = useCallback((item: Garment) => item.id, []);

  const garmentList = useMemo(() => garments ?? [], [garments]);

  const emptyComponent = useMemo(() => {
    if (isLoading) return null;
    if (selectedCategory === "all") {
      return (
        <EmptyState
          headline="Your wardrobe is waiting"
          subtext="Add your first garment"
          ctaLabel="Add your first garment"
          onCtaPress={() => {
            router.push("/(auth)/(tabs)/add");
          }}
        />
      );
    }
    return (
      <EmptyState
        headline="Nothing here yet"
        subtext={`Add a ${selectedCategory}`}
      />
    );
  }, [isLoading, selectedCategory, router]);

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
          onSelect={setSelectedCategory}
        />
      </View>

      {isLoading ? (
        <View style={{ paddingTop: CATEGORY_PILLS_HEIGHT }}>
          <SkeletonGrid columnWidth={COLUMN_WIDTH} />
        </View>
      ) : (
        <LegendList
          data={garmentList}
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
