import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { ThemedText, wearbloomTheme } from "@acme/ui";

import type { GarmentCategory } from "~/constants/categories";
import { SafeScreen } from "~/components/common/SafeScreen";
import { StepPickGarment } from "./StepPickGarment";
import { StepSeeTheMagic } from "./StepSeeTheMagic";
import { StepYourPhoto } from "./StepYourPhoto";

const PAGES = [0, 1, 2] as const;
const PAGE_COUNT = PAGES.length;
const GARMENT_TO_RESULT_DELAY_MS = 500;
type OnboardingStep = (typeof PAGES)[number];
const PREVIOUS_STEP: Record<OnboardingStep, OnboardingStep> = {
  0: 0,
  1: 0,
  2: 1,
};

interface OnboardingFlowProps {
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
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(0);
  const delayedStepRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (delayedStepRef.current !== null) {
        clearTimeout(delayedStepRef.current);
        delayedStepRef.current = null;
      }
    };
  }, []);

  const goToPage = useCallback((index: OnboardingStep) => {
    setCurrentStep(index);
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
      // Keep a brief delay for visual feedback before advancing.
      if (delayedStepRef.current !== null) {
        clearTimeout(delayedStepRef.current);
      }
      delayedStepRef.current = setTimeout(() => {
        goToPage(2);
        delayedStepRef.current = null;
      }, GARMENT_TO_RESULT_DELAY_MS);
    },
    [onGarmentSelected, goToPage],
  );

  const handleTryAnother = useCallback(() => {
    onTryAnother();
    goToPage(1);
  }, [onTryAnother, goToPage]);

  const handleGoBack = useCallback(() => {
    if (delayedStepRef.current !== null) {
      clearTimeout(delayedStepRef.current);
      delayedStepRef.current = null;
    }
    setCurrentStep((step) => PREVIOUS_STEP[step]);
  }, []);

  const stepLabel = `Onboarding step ${currentStep + 1} of ${PAGE_COUNT}`;
  const content =
    currentStep === 0 ? (
      <StepYourPhoto onPhotoSelected={handlePhotoSelected} />
    ) : currentStep === 1 ? (
      <StepPickGarment onGarmentSelected={handleGarmentSelected} />
    ) : (
      <StepSeeTheMagic
        onCreateAccount={onCreateAccount}
        onTryAnother={handleTryAnother}
        bodyPhotoUri={bodyPhotoUri}
        garmentUri={garmentUri}
      />
    );

  return (
    <SafeScreen className="bg-white" edges={["top"]}>
      <View className="pb-4 pt-2">
        {currentStep > 0 ? (
          <Pressable
            onPress={handleGoBack}
            className="absolute left-4 top-0 z-10 flex-row items-center gap-1 py-1"
            accessibilityRole="button"
            accessibilityLabel="Go to previous step"
          >
            <ArrowLeft
              size={18}
              color={wearbloomTheme.colors["text-secondary"]}
            />
            <ThemedText variant="body" className="text-text-secondary">
              Back
            </ThemedText>
          </Pressable>
        ) : null}

        <View
          className="items-center"
          accessibilityLabel="Onboarding progress"
          accessibilityRole="tablist"
        >
          <View className="flex-row gap-2">
            {PAGES.map((step) => {
              const isActive = step === currentStep;
              return (
                <View
                  key={step}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: isActive
                      ? wearbloomTheme.colors["text-primary"]
                      : wearbloomTheme.colors.border,
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>

      <View
        accessibilityLabel={stepLabel}
        accessibilityRole="summary"
        className="flex-1"
      >
        {content}
      </View>
    </SafeScreen>
  );
}
