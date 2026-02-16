import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import BottomSheet from "@gorhom/bottom-sheet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AlertDialog, Button, showToast, ThemedText } from "@acme/ui";

import type { CategoryFilter, GarmentCategory } from "~/constants/categories";
import type { PersonalGarment, WardrobeItem } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { trpc } from "~/utils/api";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { EmptyState } from "~/components/common/EmptyState";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { GarmentDetailSheet } from "~/components/garment/GarmentDetailSheet";
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
  const [garmentToDelete, setGarmentToDelete] = useState<PersonalGarment | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<WardrobeItem | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const isManualRefresh = useRef(false);

  const deleteMutation = useMutation(
    trpc.garment.delete.mutationOptions({
      onSuccess: () => {
        setGarmentToDelete(null);
        void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
        showToast({ message: "Garment deleted", variant: "success" });
      },
      onError: () => {
        setGarmentToDelete(null);
        showToast({ message: "Couldn't delete. Try again.", variant: "error" });
      },
    }),
  );

  const handleDeleteConfirm = useCallback(() => {
    if (garmentToDelete) {
      deleteMutation.mutate({ garmentId: garmentToDelete.id });
    }
  }, [garmentToDelete, deleteMutation]);

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
    if (!isConnected) {
      showToast({ message: "No internet connection", variant: "error" });
      return;
    }
    isManualRefresh.current = true;
    void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
  }, [queryClient, isConnected]);

  // Reset manual refresh flag when fetch completes
  useEffect(() => {
    if (!isFetching) {
      isManualRefresh.current = false;
    }
  }, [isFetching]);

  // Open bottom sheet when a garment is selected
  useEffect(() => {
    if (selectedGarment) {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [selectedGarment]);

  const handleSheetDismiss = useCallback(() => {
    setSelectedGarment(null);
  }, []);

  const requestRenderMutation = useMutation(
    trpc.tryon.requestRender.mutationOptions({
      onSuccess: (data) => {
        bottomSheetRef.current?.close();
        router.push(`/render/${data.renderId}` as never);
      },
      onError: (error) => {
        if (error.message === "RENDER_FAILED") {
          showToast({ message: "Render failed. Try again.", variant: "error" });
        } else {
          showToast({ message: "Something went wrong.", variant: "error" });
        }
      },
    }),
  );

  const handleTryOn = useCallback(
    (garmentId: string) => {
      requestRenderMutation.mutate({ garmentId });
    },
    [requestRenderMutation],
  );

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
        onPress={() => setSelectedGarment(item)}
        onLongPress={
          !isStockGarment(item)
            ? () => setGarmentToDelete(item as PersonalGarment)
            : undefined
        }
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
    <>
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Sticky CategoryPills header */}
        <View className="absolute top-0 right-0 left-0 z-10 bg-white/90 px-4 py-2">
          <CategoryPills
            categories={ALL_CATEGORIES}
            selected={selectedCategory}
            onSelect={handleCategorySelect}
          />
          {!isConnected && (
            <View className="mt-1 items-center rounded bg-amber-100 py-1">
              <ThemedText variant="caption" className="text-amber-800">
                Offline
              </ThemedText>
            </View>
          )}
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
            refreshing={isManualRefresh.current && isFetching}
            onRefresh={handleRefresh}
            contentContainerStyle={{ paddingTop: CATEGORY_PILLS_HEIGHT }}
            columnWrapperStyle={{ gap: GUTTER }}
            ListEmptyComponent={emptyComponent}
          />
        )}
      </SafeAreaView>
      <AlertDialog
        isOpen={garmentToDelete !== null}
        onClose={() => setGarmentToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Garment"
        message="This garment will be permanently removed from your wardrobe."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
      <GarmentDetailSheet
        ref={bottomSheetRef}
        garment={selectedGarment}
        onDismiss={handleSheetDismiss}
        onTryOn={handleTryOn}
      />
    </>
  );
}
