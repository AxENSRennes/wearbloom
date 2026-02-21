import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  useBottomSheetSpringConfigs,
} from "@gorhom/bottom-sheet";

import { Button, showToast, ThemedText } from "@acme/ui";

import type { WardrobeItem } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";
import { assertOnline } from "~/utils/assertOnline";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

interface GarmentDetailSheetProps {
  garment: WardrobeItem | null;
  onDismiss: () => void;
  onTryOn: (garmentId: string) => void;
  isTryOnLoading?: boolean;
  supportedCategories: readonly string[];
}

export const GarmentDetailSheet = forwardRef<
  BottomSheet,
  GarmentDetailSheetProps
>(function GarmentDetailSheet(
  { garment, onDismiss, onTryOn, isTryOnLoading = false, supportedCategories },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ["60%", "90%"], []);

  const animationConfigs = useBottomSheetSpringConfigs({
    damping: 50,
    stiffness: 300,
  });

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  const renderHandle = useCallback(
    () => (
      <View
        accessibilityLabel="Garment details"
        accessibilityRole="adjustable"
        accessibilityHint="Swipe up or down to resize"
      >
        <View
          style={{
            alignSelf: "center",
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#EBEBEB",
            marginVertical: 12,
          }}
        />
      </View>
    ),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  const handleTryOn = useCallback(async () => {
    if (!garment) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const online = await assertOnline();
      if (!online) return;
      onTryOn(garment.id);
    } catch {
      showToast({ message: "Something went wrong", variant: "error" });
    }
  }, [garment, onTryOn]);

  const imageSource = useMemo(
    () =>
      garment
        ? isStockGarment(garment)
          ? garment.imageSource
          : {
              uri: `${getBaseUrl()}/api/images/${garment.id}`,
              headers: (() => {
                const cookies = authClient.getCookie();
                return cookies ? { Cookie: cookies } : undefined;
              })(),
            }
        : undefined,
    [garment],
  );

  const isCategorySupported = garment
    ? supportedCategories.length === 0 ||
      supportedCategories.includes(garment.category)
    : true;

  const categoryLabel = garment
    ? garment.category.charAt(0).toUpperCase() + garment.category.slice(1)
    : "";

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleComponent={renderHandle}
      onChange={handleSheetChange}
      animateOnMount={!reducedMotion}
      animationConfigs={reducedMotion ? undefined : animationConfigs}
      backgroundStyle={{
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }}
    >
      <BottomSheetView>
        {garment ? (
          <View className="flex-1 px-4 pb-4">
            {/* Garment photo */}
            <Image
              source={imageSource}
              contentFit="contain"
              style={{
                width: "100%",
                aspectRatio: 3 / 4,
                borderRadius: 12,
              }}
              transition={200}
            />

            {/* Category badge pill */}
            <View className="mt-3 flex-row">
              <View className="rounded-full bg-surface px-3 py-1">
                <ThemedText
                  variant="caption"
                  className="text-[13px] font-medium text-text-secondary"
                >
                  {categoryLabel}
                </ThemedText>
              </View>
            </View>

            {!isCategorySupported && (
              <ThemedText
                variant="caption"
                className="mt-2 text-text-secondary"
              >
                Try-on not yet available for this category
              </ThemedText>
            )}

            {/* "Try On" button */}
            <View
              className="mt-4"
              style={{ marginBottom: Math.max(16, insets.bottom), height: 52 }}
            >
              <Button
                label="Try On"
                variant="primary"
                onPress={handleTryOn}
                disabled={!isCategorySupported || isTryOnLoading}
                isLoading={isTryOnLoading}
                accessibilityHint={
                  isCategorySupported
                    ? "Double tap to start virtual try-on"
                    : "Try-on is not available for this garment category"
                }
              />
            </View>
          </View>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
});
