import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Check, CircleCheck, X } from "lucide-react-native";

import {
  Button,
  showToast,
  Spinner,
  ThemedPressable,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import { useStoreKit } from "~/hooks/useStoreKit";
import { useSubscription } from "~/hooks/useSubscription";
import { authClient } from "~/utils/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState = "ready" | "success" | "declined" | "error";
type DisplayState =
  | "loading"
  | "productError"
  | "ready"
  | "processing"
  | "restoring"
  | ViewState;

export interface PaywallScreenProps {
  onClose: () => void;
  onSuccess: (garmentId?: string) => void;
  /** Garment for pending render after subscription — consumed by Epic 3 integration */
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

function isUserCancelledPurchaseError(error: { code?: unknown } | null) {
  if (!error || typeof error.code !== "string") return false;
  const normalizedCode = error.code.toLowerCase();
  return normalizedCode.includes("cancel");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaywallScreen({
  onClose,
  onSuccess,
  garmentId,
  __testDisplayState,
}: PaywallScreenProps) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? "";

  const {
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    product,
    isReady,
    productLoadState,
    productLoadError,
    retryProductFetch,
    purchaseError,
    verifyError,
  } = useStoreKit({ userId });

  const {
    refetch: subscriptionRefetch,
    state: subscriptionState,
    hadSubscription,
  } = useSubscription();

  const [viewState, setViewState] = useState<ViewState>("ready");
  const wasPurchasingRef = useRef(false);

  // AC#8: Determine if showing resubscribe or free trial messaging
  const isExpiredSubscriber =
    subscriptionState === "free_no_credits" && hadSubscription;

  /* eslint-disable react-hooks/set-state-in-effect -- derived from external hook state */
  // Watch for purchase errors (decline / error)
  useEffect(() => {
    if (!purchaseError) return;
    if (isUserCancelledPurchaseError(purchaseError)) {
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
        onSuccess(garmentId);
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (verifyError) {
      setViewState("error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    wasPurchasingRef.current = isPurchasing;
  }, [isPurchasing, verifyError, subscriptionRefetch, onSuccess, garmentId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Derive display state
  const displayState: DisplayState =
    __testDisplayState ??
    (() => {
      if (viewState !== "ready") return viewState;
      if (productLoadState === "error") return "productError";
      if (!isReady || productLoadState === "loading") return "loading";
      if (isPurchasing) return "processing";
      if (isRestoring) return "restoring";
      return "ready";
    })();

  // Trial info
  const trialOffer = (
    product?.subscriptionOffers as
      | { paymentMode: string; period: { unit: string; value: number } }[]
      | undefined
  )?.find((offer) => offer.paymentMode === "free-trial");
  const trialDays = trialOffer?.period.value;

  // AC#8: Resubscribe messaging for lapsed subscribers
  const ctaLabel = isExpiredSubscriber
    ? "Resubscribe for Unlimited Try-Ons"
    : trialDays
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
        "restored" in result &&
        (result as { restored: number }).restored > 0
      ) {
        showToast({ message: "Subscription restored!", variant: "success" });
        onSuccess(garmentId);
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
  }, [restore, subscriptionRefetch, onSuccess, garmentId]);

  const handleRetry = useCallback(() => {
    setViewState("ready");
  }, []);

  const handleRetryProducts = useCallback(async () => {
    setViewState("ready");
    await retryProductFetch();
  }, [retryProductFetch]);

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
  // Product load error — retry prompt
  // -------------------------------------------------------------------------
  if (displayState === "productError") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <CloseButton onClose={onClose} />
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <ThemedText variant="body" className="text-center text-error">
            Couldn't load App Store products
          </ThemedText>
          <ThemedText
            variant="caption"
            className="text-center text-text-secondary"
          >
            {productLoadError?.message ??
              "Try again in a moment or restore an existing subscription."}
          </ThemedText>
          <View className="w-full gap-3">
            <Button label="Retry" onPress={() => void handleRetryProducts()} />
            <Button
              label="Restore Purchases"
              variant="secondary"
              onPress={() => void handleRestore()}
            />
            <Button
              label="Back to wardrobe"
              variant="ghost"
              onPress={onClose}
            />
          </View>
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
          <CircleCheck size={64} color={wearbloomTheme.colors.success} />
          <ThemedText variant="display">Welcome!</ThemedText>
          <ThemedText
            variant="body"
            className="text-center text-text-secondary"
          >
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
          <ThemedText
            variant="body"
            className="text-center text-text-secondary"
          >
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

      <ScrollView
        className="flex-1 p-6"
        contentContainerClassName="flex-grow justify-center pb-8 pt-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero placeholder */}
        <View
          className="mb-6 h-48 items-center justify-center rounded-2xl bg-surface"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Your try-on result preview"
        >
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
              <Check size={20} color={wearbloomTheme.colors["text-primary"]} />
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
        <ThemedText
          variant="caption"
          className="mt-3 text-center text-text-secondary"
        >
          {isExpiredSubscriber
            ? `${product?.displayPrice ?? "\u2026"}/week. Auto-renews weekly. Cancel anytime.`
            : `Then ${product?.displayPrice ?? "\u2026"}/week. Auto-renews weekly. Cancel anytime.`}
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

        {/* Terms & Privacy */}
        <View className="mt-4 flex-row items-center justify-center gap-2">
          <ThemedPressable
            onPress={() => void Linking.openURL("https://wearbloom.app/terms")}
            accessible
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
            accessibilityHint="Double tap to view terms"
          >
            <ThemedText variant="small" className="text-text-tertiary">
              Terms
            </ThemedText>
          </ThemedPressable>
          <ThemedText variant="small" className="text-text-tertiary">
            ·
          </ThemedText>
          <ThemedPressable
            onPress={() =>
              void Linking.openURL("https://wearbloom.app/privacy")
            }
            accessible
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            accessibilityHint="Double tap to view privacy policy"
          >
            <ThemedText variant="small" className="text-text-tertiary">
              Privacy Policy
            </ThemedText>
          </ThemedPressable>
          <ThemedText variant="small" className="text-text-tertiary">
            ·
          </ThemedText>
          <ThemedPressable
            onPress={() =>
              void Linking.openURL(
                "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
              )
            }
            accessible
            accessibilityRole="link"
            accessibilityLabel="Subscription Terms"
            accessibilityHint="Double tap to view Apple subscription terms"
          >
            <ThemedText variant="small" className="text-text-tertiary">
              Subscription Terms
            </ThemedText>
          </ThemedPressable>
        </View>
      </ScrollView>
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
      <X size={24} color={wearbloomTheme.colors["text-secondary"]} />
    </Pressable>
  );
}
