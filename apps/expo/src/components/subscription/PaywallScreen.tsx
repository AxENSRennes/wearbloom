import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ErrorCode } from "expo-iap";
import { Check, CircleCheck, X } from "lucide-react-native";

import { Button, ThemedText, Spinner, ThemedPressable, showToast } from "@acme/ui";

import { authClient } from "~/utils/auth";
import { useStoreKit } from "~/hooks/useStoreKit";
import { useSubscription } from "~/hooks/useSubscription";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState = "ready" | "success" | "declined" | "error";
type DisplayState =
  | "loading"
  | "ready"
  | "processing"
  | "restoring"
  | ViewState;

export interface PaywallScreenProps {
  onClose: () => void;
  onSuccess: () => void;
  garmentId?: string;
  /** @internal Test-only prop to override display state */
  __testDisplayState?: DisplayState;
}

// ---------------------------------------------------------------------------
// Benefits data
// ---------------------------------------------------------------------------

const BENEFITS = [
  "See any garment on you",
  "Unlimited renders daily",
  "New AI models as added",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaywallScreen({
  onClose,
  onSuccess,
  __testDisplayState,
}: PaywallScreenProps) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? "";

  const {
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    product,
    isReady,
    purchaseError,
    verifyError,
  } = useStoreKit({ userId });

  const { refetch: subscriptionRefetch } = useSubscription();

  const [viewState, setViewState] = useState<ViewState>("ready");
  const wasPurchasingRef = useRef(false);

  // Watch for purchase errors (decline / error)
  useEffect(() => {
    if (!purchaseError) return;
    if (purchaseError.code === ErrorCode.UserCancelled) {
      setViewState("declined");
    } else {
      setViewState("error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [purchaseError]);

  // Watch for successful verification
  useEffect(() => {
    if (wasPurchasingRef.current && !isPurchasing && !verifyError) {
      setViewState("success");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const timer = setTimeout(() => {
        void subscriptionRefetch();
        onSuccess();
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (verifyError) {
      setViewState("error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    wasPurchasingRef.current = isPurchasing;
  }, [isPurchasing, verifyError, subscriptionRefetch, onSuccess]);

  // Derive display state
  const displayState: DisplayState =
    __testDisplayState ??
    (() => {
      if (viewState !== "ready") return viewState;
      if (!isReady) return "loading";
      if (isPurchasing) return "processing";
      if (isRestoring) return "restoring";
      return "ready";
    })();

  // Trial info
  const trialOffer = (
    product?.subscriptionOffers as
      | Array<{ paymentMode: string; period: { unit: string; value: number } }>
      | undefined
  )?.find((offer) => offer.paymentMode === "free-trial");
  const trialDays = trialOffer?.period?.value;
  const ctaLabel = trialDays
    ? `Start Your ${String(trialDays)}-Day Free Trial`
    : "Subscribe Now";

  const handlePurchase = useCallback(() => {
    setViewState("ready");
    void purchase();
  }, [purchase]);

  const handleRestore = useCallback(async () => {
    try {
      const result = await restore();
      await subscriptionRefetch();
      if (
        result &&
        typeof result === "object" &&
        "restored" in result &&
        (result as { restored: number }).restored > 0
      ) {
        showToast({ message: "Subscription restored!", variant: "success" });
        onSuccess();
      } else {
        showToast({
          message: "No previous purchases found",
          variant: "info",
        });
      }
    } catch {
      showToast({
        message: "Could not restore purchases. Try again.",
        variant: "error",
      });
    }
  }, [restore, subscriptionRefetch, onSuccess]);

  const handleRetry = useCallback(() => {
    setViewState("ready");
  }, []);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (displayState === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Success celebration
  // -------------------------------------------------------------------------
  if (displayState === "success") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <CircleCheck size={64} color="#22c55e" />
          <ThemedText variant="display">Welcome!</ThemedText>
          <ThemedText variant="body" className="text-center text-text-secondary">
            Try on anything, anytime.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Declined — soft message
  // -------------------------------------------------------------------------
  if (displayState === "declined") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CloseButton onClose={onClose} />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ThemedText variant="body" className="text-center text-text-secondary">
            No worries — your wardrobe is always here.
          </ThemedText>
          <Button label="Back to wardrobe" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Error — retry prompt
  // -------------------------------------------------------------------------
  if (displayState === "error") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CloseButton onClose={onClose} />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ThemedText variant="body" className="text-center text-error">
            Something went wrong. Try again.
          </ThemedText>
          <Button label="Try again" onPress={handleRetry} />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Ready / Processing / Restoring — full paywall
  // -------------------------------------------------------------------------
  const isProcessing = displayState === "processing";
  const isRestoringNow = displayState === "restoring";

  return (
    <SafeAreaView className="flex-1 bg-background">
      <CloseButton onClose={onClose} />

      <View className="flex-1 justify-center p-6">
        {/* Hero placeholder */}
        <View className="mb-6 h-48 items-center justify-center rounded-2xl bg-surface">
          <ThemedText variant="caption" className="text-text-tertiary">
            Your try-on result preview
          </ThemedText>
        </View>

        {/* Headline */}
        <ThemedText variant="display" className="mb-6">
          Unlimited Try-Ons
        </ThemedText>

        {/* Benefits */}
        <View className="mb-6 gap-3">
          {BENEFITS.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <Check size={20} color="#1A1A1A" />
              <ThemedText variant="body">{benefit}</ThemedText>
            </View>
          ))}
        </View>

        {/* CTA button */}
        <Button
          label={isProcessing ? "Confirming..." : ctaLabel}
          onPress={handlePurchase}
          isLoading={isProcessing}
          disabled={isProcessing}
        />

        {/* Price disclosure */}
        <ThemedText variant="caption" className="mt-3 text-center text-text-secondary">
          Then {product?.displayPrice as string}/week. Cancel anytime.
        </ThemedText>

        {/* Restore purchases */}
        <ThemedPressable
          className="mt-4 items-center py-2"
          onPress={() => void handleRestore()}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityHint="Double tap to restore previous subscription"
          disabled={isRestoringNow}
        >
          {isRestoringNow ? (
            <View className="flex-row items-center gap-2">
              <Spinner size="small" />
              <ThemedText variant="caption" className="text-text-secondary">
                Restoring...
              </ThemedText>
            </View>
          ) : (
            <ThemedText variant="caption" className="text-text-secondary">
              Restore Purchases
            </ThemedText>
          )}
        </ThemedPressable>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// CloseButton — extracted for reuse across states
// ---------------------------------------------------------------------------

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Pressable
      className="absolute right-4 top-4 z-10 h-11 w-11 items-center justify-center"
      onPress={onClose}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Close paywall"
      accessibilityHint="Double tap to return to wardrobe"
    >
      <X size={24} color="#868e96" />
    </Pressable>
  );
}
