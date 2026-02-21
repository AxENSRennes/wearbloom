import type BottomSheet from "@gorhom/bottom-sheet";
import type { Href } from "expo-router";
import { useCallback, useMemo, useReducer, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AlertDialog, Button, showToast, ThemedText } from "@acme/ui";

import type { CategoryFilter } from "~/constants/categories";
import type { PersonalGarment, WardrobeItem } from "~/types/wardrobe";
import { EmptyState } from "~/components/common/EmptyState";
import { SafeScreen } from "~/components/common/SafeScreen";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { GarmentDetailSheet } from "~/components/garment/GarmentDetailSheet";
import { SkeletonGrid } from "~/components/garment/SkeletonGrid";
import { ALL_CATEGORIES } from "~/constants/categories";
import { getStockGarmentsByCategory } from "~/constants/stockGarments";
import { useEnsureBodyPhotoForRender } from "~/hooks/useEnsureBodyPhotoForRender";
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { usePaywallGuard } from "~/hooks/usePaywallGuard";
import { useScrollFeedback } from "~/hooks/useScrollFeedback";
import { useStockGarmentPreferences } from "~/hooks/useStockGarmentPreferences";
import { isStockGarment } from "~/types/wardrobe";
import { trpc } from "~/utils/api";

const GUTTER = 6;
const NUM_COLUMNS = 2;
const GRID_HORIZONTAL_PADDING = 8;
const LIST_BOTTOM_EXTRA_PADDING = 120;

interface WardrobeUiState {
  selectedCategory: CategoryFilter;
  garmentToDelete: PersonalGarment | null;
  selectedGarment: WardrobeItem | null;
  stockGarmentToHide: WardrobeItem | null;
  isManualRefresh: boolean;
}

type WardrobeUiAction =
  | { type: "SET_CATEGORY"; category: CategoryFilter }
  | { type: "START_MANUAL_REFRESH" }
  | { type: "END_MANUAL_REFRESH" }
  | { type: "SELECT_GARMENT"; garment: WardrobeItem }
  | { type: "CLEAR_SELECTED_GARMENT" }
  | { type: "SET_GARMENT_TO_DELETE"; garment: PersonalGarment | null }
  | { type: "SET_STOCK_GARMENT_TO_HIDE"; garment: WardrobeItem | null };

const initialWardrobeUiState: WardrobeUiState = {
  selectedCategory: "all",
  garmentToDelete: null,
  selectedGarment: null,
  stockGarmentToHide: null,
  isManualRefresh: false,
};

function wardrobeUiReducer(
  state: WardrobeUiState,
  action: WardrobeUiAction,
): WardrobeUiState {
  switch (action.type) {
    case "SET_CATEGORY":
      return { ...state, selectedCategory: action.category };
    case "START_MANUAL_REFRESH":
      return { ...state, isManualRefresh: true };
    case "END_MANUAL_REFRESH":
      return { ...state, isManualRefresh: false };
    case "SELECT_GARMENT":
      return { ...state, selectedGarment: action.garment };
    case "CLEAR_SELECTED_GARMENT":
      return { ...state, selectedGarment: null };
    case "SET_GARMENT_TO_DELETE":
      return { ...state, garmentToDelete: action.garment };
    case "SET_STOCK_GARMENT_TO_HIDE":
      return { ...state, stockGarmentToHide: action.garment };
  }
}

function isCategoryFilter(value: string): value is CategoryFilter {
  return ALL_CATEGORIES.includes(value as CategoryFilter);
}

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [uiState, dispatch] = useReducer(
    wardrobeUiReducer,
    initialWardrobeUiState,
  );
  const bottomSheetRef = useRef<BottomSheet>(null);
  const pagerRef = useRef<PagerView>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const { guardRender } = usePaywallGuard();
  const { ensureBodyPhotoForRender, isEnsuringBodyPhoto } =
    useEnsureBodyPhotoForRender();
  const { hiddenIds, showStock, hideGarment } = useStockGarmentPreferences();

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

  const supportedCategoriesQuery = useQuery(
    trpc.tryon.getSupportedCategories.queryOptions(),
  );
  const supportedCategories = supportedCategoriesQuery.data ?? [];

  const deleteMutation = useMutation(
    trpc.garment.delete.mutationOptions({
      onSuccess: () => {
        dispatch({ type: "SET_GARMENT_TO_DELETE", garment: null });
        void queryClient.invalidateQueries({
          queryKey: trpc.garment.list.queryKey(),
        });
        showToast({ message: "Garment deleted", variant: "success" });
      },
      onError: () => {
        dispatch({ type: "SET_GARMENT_TO_DELETE", garment: null });
        showToast({ message: "Couldn't delete. Try again.", variant: "error" });
      },
    }),
  );

  const handleDeleteConfirm = useCallback(() => {
    if (uiState.garmentToDelete) {
      deleteMutation.mutate({ garmentId: uiState.garmentToDelete.id });
    }
  }, [deleteMutation, uiState.garmentToDelete]);

  // Fetch ALL garments without category filter so swiping between pages is instant
  const {
    data: garments,
    isLoading,
    isFetching,
    isError,
    error: _error,
  } = useQuery(trpc.garment.list.queryOptions());

  const getItemsForCategory = useCallback(
    (category: CategoryFilter): WardrobeItem[] => {
      const personal: WardrobeItem[] = (garments ?? [])
        .filter((g) => category === "all" || g.category === category)
        .map((garment) => ({
          ...garment,
          isStock: false as const,
        }));
      if (!showStock) return personal;
      const stockItems = getStockGarmentsByCategory(category).filter(
        (stockItem) => !hiddenIds.includes(stockItem.id),
      );
      return [...personal, ...stockItems];
    },
    [garments, hiddenIds, showStock],
  );

  const handleRefresh = useCallback(() => {
    if (!isConnected) {
      showToast({ message: "No internet connection", variant: "error" });
      return;
    }
    dispatch({ type: "START_MANUAL_REFRESH" });
    void queryClient
      .invalidateQueries({
        queryKey: trpc.garment.list.queryKey(),
      })
      .finally(() => {
        dispatch({ type: "END_MANUAL_REFRESH" });
      });
  }, [isConnected, queryClient]);

  const handleGarmentPress = useCallback((garment: WardrobeItem) => {
    dispatch({ type: "SELECT_GARMENT", garment });
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleSheetDismiss = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTED_GARMENT" });
  }, []);

  const requestRenderMutation = useMutation(
    trpc.tryon.requestRender.mutationOptions(),
  );

  const routeToBodyPhoto = useCallback(() => {
    bottomSheetRef.current?.close();
    showToast({
      message: "Add your body photo to continue.",
      variant: "info",
    });
    router.push("/(auth)/body-photo" as Href);
  }, [router]);

  const handleTryOn = useCallback(
    (garmentId: string) => {
      void (async () => {
        if (!guardRender(garmentId)) {
          bottomSheetRef.current?.close();
          return;
        }

        const bodyPhotoResult = await ensureBodyPhotoForRender();
        if (bodyPhotoResult.status === "missing") {
          routeToBodyPhoto();
          return;
        }
        if (bodyPhotoResult.status === "error") {
          showToast({
            message: "Couldn't verify your body photo. Try again.",
            variant: "error",
          });
          return;
        }

        requestRenderMutation.mutate(
          { garmentId },
          {
            onSuccess: (data) => {
              bottomSheetRef.current?.close();
              router.push(`/render/${data.renderId}` as Href);
            },
            onError: (err) => {
              if (err.message === "INSUFFICIENT_CREDITS") {
                bottomSheetRef.current?.close();
                router.push(
                  `/(auth)/paywall?garmentId=${encodeURIComponent(garmentId)}` as Href,
                );
              } else if (err.message === "NO_BODY_PHOTO") {
                routeToBodyPhoto();
              } else if (err.message === "INVALID_CATEGORY") {
                showToast({
                  message: "Try-on not available for this category.",
                  variant: "error",
                });
              } else if (err.message === "RENDER_FAILED") {
                showToast({
                  message: "Render failed. Try again.",
                  variant: "error",
                });
              } else {
                showToast({
                  message: "Something went wrong.",
                  variant: "error",
                });
              }
            },
          },
        );
      })();
    },
    [
      ensureBodyPhotoForRender,
      guardRender,
      requestRenderMutation,
      routeToBodyPhoto,
      router,
    ],
  );

  const handleHideStockConfirm = useCallback(() => {
    if (uiState.stockGarmentToHide) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void hideGarment(uiState.stockGarmentToHide.id);
      dispatch({ type: "SET_STOCK_GARMENT_TO_HIDE", garment: null });
      showToast({ message: "Stock garment hidden", variant: "info" });
    }
  }, [hideGarment, uiState.stockGarmentToHide]);

  const renderGarment = useCallback(
    ({ item }: { item: WardrobeItem }) => (
      <GarmentCard
        garment={item}
        onPress={() => handleGarmentPress(item)}
        onLongPress={
          isStockGarment(item)
            ? () =>
                dispatch({ type: "SET_STOCK_GARMENT_TO_HIDE", garment: item })
            : () => dispatch({ type: "SET_GARMENT_TO_DELETE", garment: item })
        }
        columnWidth={columnWidth}
      />
    ),
    [columnWidth, handleGarmentPress],
  );

  const keyExtractor = useCallback((item: WardrobeItem) => item.id, []);

  const unsupportedCategories = useMemo(() => {
    if (!supportedCategoriesQuery.data) return [];
    return ALL_CATEGORIES.filter(
      (category) =>
        category !== "all" && !supportedCategoriesQuery.data.includes(category),
    );
  }, [supportedCategoriesQuery.data]);

  const handleCategoryPillSelect = useCallback((category: string) => {
    if (!isCategoryFilter(category)) return;
    const index = ALL_CATEGORIES.indexOf(category);
    if (index < 0) return;
    pagerRef.current?.setPage(index);
  }, []);

  const handleSnapToItem = useCallback((index: number) => {
    const category = ALL_CATEGORIES[index];
    if (category) {
      dispatch({ type: "SET_CATEGORY", category });
    }
  }, []);

  const { scrollProps } = useScrollFeedback({
    screen: "wardrobe-grid",
  });

  const renderCarouselPage = useCallback(
    (category: CategoryFilter) => {
      const items = getItemsForCategory(category);

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
          refreshing={uiState.isManualRefresh && isFetching}
          onRefresh={handleRefresh}
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
    },
    [
      columnWidth,
      getItemsForCategory,
      handleRefresh,
      isFetching,
      isLoading,
      itemHeight,
      keyExtractor,
      listContentBottomPadding,
      renderGarment,
      scrollProps,
      uiState.isManualRefresh,
    ],
  );

  if (isError) {
    return (
      <SafeScreen className="bg-background">
        <View className="flex-1 items-center justify-center p-4">
          <ThemedText variant="heading">Something went wrong</ThemedText>
          <ThemedText
            variant="body"
            className="mt-2 text-center text-text-secondary"
          >
            We couldn't load your wardrobe. Please check your connection and try
            again.
          </ThemedText>
          <View className="mt-6">
            <Button
              variant="secondary"
              label="Try again"
              onPress={handleRefresh}
            />
          </View>
        </View>
      </SafeScreen>
    );
  }

  return (
    <>
      <SafeScreen className="bg-background">
        <View className="border-b border-black/5 bg-background pb-3 pt-2">
          <CategoryPills
            categories={ALL_CATEGORIES}
            selected={uiState.selectedCategory}
            onSelect={handleCategoryPillSelect}
            unsupportedCategories={unsupportedCategories}
          />
          {!isConnected && (
            <View className="mx-4 mt-2 items-center rounded bg-amber-100 py-1">
              <ThemedText variant="caption" className="text-amber-800">
                Offline
              </ThemedText>
            </View>
          )}
        </View>
        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={(e) => handleSnapToItem(e.nativeEvent.position)}
        >
          {ALL_CATEGORIES.map((category) => (
            <View key={category} collapsable={false}>
              {renderCarouselPage(category)}
            </View>
          ))}
        </PagerView>
      </SafeScreen>
      <AlertDialog
        isOpen={uiState.garmentToDelete !== null}
        onClose={() =>
          dispatch({ type: "SET_GARMENT_TO_DELETE", garment: null })
        }
        onConfirm={handleDeleteConfirm}
        title="Delete Garment"
        message="This garment will be permanently removed from your wardrobe."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
      <AlertDialog
        isOpen={uiState.stockGarmentToHide !== null}
        onClose={() =>
          dispatch({ type: "SET_STOCK_GARMENT_TO_HIDE", garment: null })
        }
        onConfirm={handleHideStockConfirm}
        title="Hide stock garment?"
        message="You can restore it later from Settings."
        confirmLabel="Hide"
      />
      <GarmentDetailSheet
        ref={bottomSheetRef}
        garment={uiState.selectedGarment}
        onDismiss={handleSheetDismiss}
        onTryOn={handleTryOn}
        isTryOnLoading={requestRenderMutation.isPending || isEnsuringBodyPhoto}
        supportedCategories={supportedCategories}
      />
    </>
  );
}
