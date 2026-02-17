import type { ReactElement } from "react";
import type { ICarouselInstance } from "react-native-reanimated-carousel";
import { useCallback, useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { Pagination } from "react-native-reanimated-carousel";

import type { GarmentCategory } from "~/constants/stockAssets";
import { colors } from "~/constants/theme";
import { StepPickGarment } from "./StepPickGarment";
import { StepSeeTheMagic } from "./StepSeeTheMagic";
import { StepYourPhoto } from "./StepYourPhoto";

const PAGES = [0, 1, 2] as const;
const PAGE_COUNT = PAGES.length;

export interface OnboardingFlowProps {
  onPhotoSelected: (uri: string, isStock: boolean) => void;
  onGarmentSelected: (
    uri: string,
    category: GarmentCategory,
    isStock: boolean,
  ) => void;
  onCreateAccount: () => void;
  onTryAnother: () => void;
  bodyPhotoUri?: string;
  garmentUri?: string;
}

export function OnboardingFlow({
  onPhotoSelected,
  onGarmentSelected,
  onCreateAccount,
  onTryAnother,
  bodyPhotoUri,
  garmentUri,
}: OnboardingFlowProps): ReactElement {
  const { width: screenWidth } = useWindowDimensions();
  const carouselRef = useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);

  const goToPage = useCallback((index: number) => {
    carouselRef.current?.scrollTo({
      index,
      animated: true,
    });
  }, []);

  const handlePhotoSelected = useCallback(
    (uri: string, isStock: boolean) => {
      onPhotoSelected(uri, isStock);
      goToPage(1);
    },
    [onPhotoSelected, goToPage],
  );

  const handleGarmentSelected = useCallback(
    (uri: string, category: GarmentCategory, isStock: boolean) => {
      onGarmentSelected(uri, category, isStock);
      // 500ms delay for visual feedback before advancing
      setTimeout(() => goToPage(2), 500);
    },
    [onGarmentSelected, goToPage],
  );

  const handleTryAnother = useCallback(() => {
    onTryAnother();
    goToPage(1);
  }, [onTryAnother, goToPage]);

  const renderPage = useCallback(
    ({ index }: { item: number; index: number }) => {
      const stepLabel = `Onboarding step ${index + 1} of ${PAGE_COUNT}`;
      const content = (() => {
        switch (index) {
          case 0:
            return <StepYourPhoto onPhotoSelected={handlePhotoSelected} />;
          case 1:
            return (
              <StepPickGarment onGarmentSelected={handleGarmentSelected} />
            );
          case 2:
            return (
              <StepSeeTheMagic
                onCreateAccount={onCreateAccount}
                onTryAnother={handleTryAnother}
                bodyPhotoUri={bodyPhotoUri}
                garmentUri={garmentUri}
              />
            );
          default:
            return null;
        }
      })();
      return (
        <View
          accessibilityLabel={stepLabel}
          accessibilityRole="summary"
          className="flex-1"
        >
          {content}
        </View>
      );
    },
    [
      handlePhotoSelected,
      handleGarmentSelected,
      onCreateAccount,
      handleTryAnother,
      bodyPhotoUri,
      garmentUri,
    ],
  );

  return (
    <View className="flex-1 bg-white">
      <View
        className="items-center pb-4 pt-2"
        accessibilityLabel="Onboarding progress"
        accessibilityRole="tablist"
      >
        <Pagination.Basic
          progress={progress}
          data={[...PAGES]}
          size={10}
          dotStyle={{
            width: 10,
            height: 10,
            backgroundColor: colors.border,
            borderRadius: 5,
          }}
          activeDotStyle={{
            width: 10,
            height: 10,
            backgroundColor: colors.textPrimary,
            borderRadius: 5,
            overflow: "hidden",
          }}
          containerStyle={{
            gap: 8,
          }}
        />
      </View>

      <Carousel
        ref={carouselRef}
        data={[...PAGES]}
        width={screenWidth}
        height={undefined}
        loop={false}
        enabled={false}
        onProgressChange={progress}
        renderItem={renderPage}
        style={{ flex: 1 }}
      />
    </View>
  );
}
