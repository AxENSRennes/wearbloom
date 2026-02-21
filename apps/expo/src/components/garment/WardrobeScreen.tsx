import type BottomSheet from "@gorhom/bottom-sheet";
import type { Href } from "expo-router";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LegendList } from "@legendapp/list";
import type { LegendListRef } from "@legendapp/list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AlertDialog, Button, showToast, ThemedText } from "@acme/ui";

import type { CategoryFilter } from "~/constants/categories";
import type { CategorySwipeSource } from "~/hooks/useCategorySwipeNavigation";
import type { PersonalGarment, WardrobeItem } from "~/types/wardrobe";
import { EmptyState } from "~/components/common/EmptyState";
import { SafeScreen } from "~/components/common/SafeScreen";
import { CategoryPills } from "~/components/garment/CategoryPills";
import { GarmentCard } from "~/components/garment/GarmentCard";
import { GarmentDetailSheet } from "~/components/garment/GarmentDetailSheet";
import { SkeletonGrid } from "~/components/garment/SkeletonGrid";
import { ALL_CATEGORIES } from "~/constants/categories";
import { getStockGarmentsByCategory } from "~/constants/stockGarments";
import { useCategorySwipeNavigation } from "~/hooks/useCategorySwipeNavigation";
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
const CATEGORY_TRANSITION_OUT_MS = 100;
const CATEGORY_TRANSITION_IN_MS = 160;

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
  const listRef = useRef<LegendListRef>(null);
  const categoryScrollOffsetsRef = useRef<Map<CategoryFilter, number>>(
    new Map(),
  );
  const pendingRestoreOffsetRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const categoryTransitionProgress = useSharedValue(0);
  const categoryTransitionDirection = useSharedValue(-1);
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
  const animatedListStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : 1 - categoryTransitionProgress.value * 0.08,
    transform: [
      {
        translateX: reducedMotion
          ? 0
          : categoryTransitionDirection.value *
            categoryTransitionProgress.value *
            8,
      },
    ],
  }));

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

  const playCategoryTransition = useCallback(
    (direction: "left" | "right") => {
      if (reducedMotion) return;
      categoryTransitionDirection.set(direction === "left" ? -1 : 1);
      categoryTransitionProgress.set(
        withSequence(
          withTiming(1, { duration: CATEGORY_TRANSITION_OUT_MS }),
          withTiming(0, { duration: CATEGORY_TRANSITION_IN_MS }),
        ),
      );
    },
    [categoryTransitionDirection, categoryTransitionProgress, reducedMotion],
  );

  const handleCategorySelection = useCallback(
    (category: CategoryFilter, source: CategorySwipeSource) => {
      if (category === uiState.selectedCategory) return;

      const currentOffset =
        categoryScrollOffsetsRef.current.get(uiState.selectedCategory) ?? 0;
      categoryScrollOffsetsRef.current.set(uiState.selectedCategory, currentOffset);
      pendingRestoreOffsetRef.current =
        categoryScrollOffsetsRef.current.get(category) ?? 0;

      const currentIndex = ALL_CATEGORIES.indexOf(uiState.selectedCategory);
      const nextIndex = ALL_CATEGORIES.indexOf(category);
      const direction =
        source === "swipe-right" || nextIndex < currentIndex ? "right" : "left";
      playCategoryTransition(direction);
      dispatch({ type: "SET_CATEGORY", category });
    },
    [playCategoryTransition, uiState.selectedCategory],
  );

  const { selectedIndex, selectFromTap, swipeGesture } =
    useCategorySwipeNavigation({
      categories: ALL_CATEGORIES,
      selectedCategory: uiState.selectedCategory,
      onCategorySelect: handleCategorySelection,
    });

  const handleCategoryPillSelect = useCallback(
    (category: string) => {
      if (!isCategoryFilter(category)) return;
      selectFromTap(category);
    },
    [selectFromTap],
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

  const wardrobeItems: WardrobeItem[] = useMemo(() => {
    const personal: WardrobeItem[] = (garments ?? []).map((garment) => ({
      ...garment,
      isStock: false as const,
    }));
    if (!showStock) return personal;
    const stockItems = getStockGarmentsByCategory(
      uiState.selectedCategory,
    ).filter((stockItem) => !hiddenIds.includes(stockItem.id));
    return [...personal, ...stockItems];
  }, [garments, hiddenIds, showStock, uiState.selectedCategory]);

  useEffect(() => {
    if (pendingRestoreOffsetRef.current === null) return;
    const targetOffset = pendingRestoreOffsetRef.current;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, targetOffset),
        animated: false,
      });
      pendingRestoreOffsetRef.current = null;
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [uiState.selectedCategory, wardrobeItems.length]);

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

  const emptyComponent = useMemo(() => {
    if (isLoading) {
      return (
        <View className="pt-3">
          <SkeletonGrid columnWidth={columnWidth} />
        </View>
      );
    }
    return (
      <EmptyState
        headline="Nothing here yet"
        subtext={`Add a ${uiState.selectedCategory}`}
      />
    );
  }, [columnWidth, isLoading, uiState.selectedCategory]);

  const unsupportedCategories = useMemo(() => {
    if (!supportedCategoriesQuery.data) return [];
    return ALL_CATEGORIES.filter(
      (category) =>
        category !== "all" && !supportedCategoriesQuery.data.includes(category),
    );
  }, [supportedCategoriesQuery.data]);

  const listHeaderComponent = useMemo(
    () => (
      <View className="border-b border-black/5 bg-background px-4 pb-3 pt-2">
        <View className="mb-2 flex-row items-center justify-between">
          <ThemedText variant="small" className="text-text-tertiary">
            Swipe left or right to switch category
          </ThemedText>
          <ThemedText variant="small" className="text-text-tertiary">
            {`${Math.max(1, selectedIndex + 1)}/${ALL_CATEGORIES.length}`}
          </ThemedText>
        </View>
        <CategoryPills
          categories={ALL_CATEGORIES}
          selected={uiState.selectedCategory}
          onSelect={handleCategoryPillSelect}
          unsupportedCategories={unsupportedCategories}
        />
        {!isConnected && (
          <View className="mt-2 items-center rounded bg-amber-100 py-1">
            <ThemedText variant="caption" className="text-amber-800">
              Offline
            </ThemedText>
          </View>
        )}
      </View>
    ),
    [
      handleCategoryPillSelect,
      isConnected,
      selectedIndex,
      uiState.selectedCategory,
      unsupportedCategories,
    ],
  );

  const { scrollProps } = useScrollFeedback({
    screen: "wardrobe-grid",
  });

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollProps.onScroll(event);
      categoryScrollOffsetsRef.current.set(
        uiState.selectedCategory,
        Math.max(0, event.nativeEvent.contentOffset.y),
      );
    },
    [scrollProps, uiState.selectedCategory],
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
        <GestureDetector gesture={swipeGesture}>
          <Animated.View className="flex-1" style={animatedListStyle}>
            <LegendList
              ref={listRef}
              data={isLoading ? [] : wardrobeItems}
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
              ListHeaderComponent={listHeaderComponent}
              stickyIndices={[0]}
              contentContainerStyle={{
                paddingHorizontal: GRID_HORIZONTAL_PADDING,
                paddingBottom: listContentBottomPadding,
              }}
              columnWrapperStyle={{ gap: GUTTER }}
              ListEmptyComponent={emptyComponent}
              scrollEventThrottle={scrollProps.scrollEventThrottle}
              onLayout={scrollProps.onLayout}
              onContentSizeChange={scrollProps.onContentSizeChange}
              onScroll={handleListScroll}
              onScrollBeginDrag={scrollProps.onScrollBeginDrag}
              onScrollEndDrag={scrollProps.onScrollEndDrag}
            />
          </Animated.View>
        </GestureDetector>
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
