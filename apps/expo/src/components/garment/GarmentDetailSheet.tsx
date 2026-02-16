import { forwardRef, useCallback, useMemo } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

import { Button, ThemedText } from "@acme/ui";

import type { WardrobeItem } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";
import { assertOnline } from "~/utils/assertOnline";
import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

interface GarmentDetailSheetProps {
  garment: WardrobeItem | null;
  onDismiss: () => void;
  onTryOn: (garmentId: string) => void;
}

export const GarmentDetailSheet = forwardRef<BottomSheet, GarmentDetailSheetProps>(
  function GarmentDetailSheet({ garment, onDismiss, onTryOn }, ref) {
    const reducedMotion = useReducedMotion();
    const snapPoints = useMemo(() => ["60%", "90%"], []);

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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const online = await assertOnline();
      if (!online) return;
      onTryOn(garment.id);
    }, [garment, onTryOn]);

    const imageSource = garment
      ? isStockGarment(garment)
        ? garment.imageSource
        : {
            uri: `${getBaseUrl()}/api/images/${garment.id}`,
            headers: (() => {
              const cookies = authClient.getCookie();
              return cookies ? { Cookie: cookies } : undefined;
            })(),
          }
      : undefined;

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
                <View className="rounded-full bg-[#F7F7F7] px-3 py-1">
                  <ThemedText
                    variant="caption"
                    className="text-[13px] font-medium text-[#6B6B6B]"
                  >
                    {categoryLabel}
                  </ThemedText>
                </View>
              </View>

              {/* "Try On" button */}
              <View className="mt-4" style={{ marginBottom: 16, height: 52 }}>
                <Button
                  label="Try On"
                  variant="primary"
                  onPress={handleTryOn}
                  accessibilityHint="Double tap to start virtual try-on"
                />
              </View>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
