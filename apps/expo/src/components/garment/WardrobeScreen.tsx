import type BottomSheet from "@gorhom/bottom-sheet";
import type { Href } from "expo-router";
import { useCallback, useMemo, useReducer, useRef } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
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
import { useNetworkStatus } from "~/hooks/useNetworkStatus";
import { usePaywallGuard } from "~/hooks/usePaywallGuard";
import { useScrollFeedback } from "~/hooks/useScrollFeedback";
import { useStockGarmentPreferences } from "~/hooks/useStockGarmentPreferences";
import { isStockGarment } from "~/types/wardrobe";
import { trpc } from "~/utils/api";

const GUTTER = 2;
const NUM_COLUMNS = 2;
const { width: screenWidth } = Dimensions.get("window");
const COLUMN_WIDTH = (screenWidth - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ITEM_HEIGHT = Math.round(COLUMN_WIDTH * 1.2);
const CATEGORY_PILLS_HEIGHT = 60;

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

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const [uiState, dispatch] = useReducer(
    wardrobeUiReducer,
    initialWardrobeUiState,
  );
  const bottomSheetRef = useRef<BottomSheet>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isConnected } = useNetworkStatus();
  const { guardRender } = usePaywallGuard();
  const { hiddenIds, showStock, hideGarment } = useStockGarmentPreferences();

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
  }, [uiState.garmentToDelete, deleteMutation]);

  const {
    data: garments,
    isLoading,
    isFetching,
    isError,
    error: _error,
  } = useQuery(
    trpc.garment.list.queryOptions(
      uiState.selectedCategory === "all"
        ? undefined
        : { category: uiState.selectedCategory },
    ),
  );

  const handleCategorySelect = useCallback(
    (category: string) =>
      dispatch({ type: "SET_CATEGORY", category: category as CategoryFilter }),
    [],
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
  }, [queryClient, isConnected]);

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

  const handleTryOn = useCallback(
    (garmentId: string) => {
      if (!guardRender(garmentId)) {
        bottomSheetRef.current?.close();
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
              showToast({ message: "Something went wrong.", variant: "error" });
            }
          },
        },
      );
    },
    [guardRender, requestRenderMutation, router],
  );

  const wardrobeItems: WardrobeItem[] = useMemo(() => {
    const personal: WardrobeItem[] = (garments ?? []).map((g) => ({
      ...g,
      isStock: false as const,
    }));
    if (!showStock) return personal;
    const stockItems = getStockGarmentsByCategory(
      uiState.selectedCategory,
    ).filter((s) => !hiddenIds.includes(s.id));
    return [...personal, ...stockItems];
  }, [garments, uiState.selectedCategory, showStock, hiddenIds]);

  const handleHideStockConfirm = useCallback(() => {
    if (uiState.stockGarmentToHide) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void hideGarment(uiState.stockGarmentToHide.id);
      dispatch({ type: "SET_STOCK_GARMENT_TO_HIDE", garment: null });
      showToast({ message: "Stock garment hidden", variant: "info" });
    }
  }, [uiState.stockGarmentToHide, hideGarment]);

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
        columnWidth={COLUMN_WIDTH}
      />
    ),
    [handleGarmentPress],
  );

  const keyExtractor = useCallback((item: WardrobeItem) => item.id, []);

  const emptyComponent = useMemo(() => {
    if (isLoading) return null;
    // Stock garments ensure "all" category is never truly empty
    return (
      <EmptyState
        headline="Nothing here yet"
        subtext={`Add a ${uiState.selectedCategory}`}
      />
    );
  }, [isLoading, uiState.selectedCategory]);
  const headerOffsetTop = insets.top;
  const listContentTopPadding = CATEGORY_PILLS_HEIGHT + insets.top;
  const listContentBottomPadding = Math.max(24, insets.bottom + 32);
  const { scrollProps, containerProps } = useScrollFeedback({
    screen: "wardrobe-grid",
  });

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
      <SafeScreen className="bg-background" edges={["bottom"]}>
        {/* Sticky CategoryPills header */}
        <View
          className="absolute left-0 right-0 z-10 overflow-hidden px-4 py-2"
          style={{
            top: headerOffsetTop,
            backgroundColor:
              Platform.OS === "ios"
                ? "rgba(255,255,255,0.78)"
                : "rgba(255,255,255,0.9)",
          }}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              testID="wardrobe-category-header-blur"
              tint="light"
              intensity={25}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View>
            <CategoryPills
              categories={ALL_CATEGORIES}
              selected={uiState.selectedCategory}
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
        </View>

        {isLoading ? (
          <View style={{ paddingTop: listContentTopPadding }}>
            <SkeletonGrid columnWidth={COLUMN_WIDTH} />
          </View>
        ) : (
          <LegendList
            data={wardrobeItems}
            renderItem={renderGarment}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            style={{ flex: 1 }}
            estimatedItemSize={ITEM_HEIGHT}
            recycleItems
            bounces
            alwaysBounceVertical
            overScrollMode="always"
            showsVerticalScrollIndicator
            refreshing={uiState.isManualRefresh && isFetching}
            onRefresh={handleRefresh}
            contentContainerStyle={{
              paddingTop: listContentTopPadding,
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
            onTouchMove={containerProps.onTouchMove}
          />
        )}
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
        supportedCategories={supportedCategories}
      />
    </>
  );
}
