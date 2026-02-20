import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheck, X } from "lucide-react-native";

import {
  Button,
  showToast,
  Spinner,
  ThemedPressable,
  ThemedText,
  wearbloomTheme,
} from "@acme/ui";

import { STOCK_BODY_PHOTO } from "~/constants/stockAssets";
import { useStoreKit } from "~/hooks/useStoreKit";
import { useSubscription } from "~/hooks/useSubscription";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { getAuthHeaders } from "~/utils/authHeaders";
import { getBaseUrl } from "~/utils/base-url";

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

type HeroImageSource = ComponentProps<typeof Image>["source"];

interface TrialOffer {
  paymentMode: string;
  period: { unit: string; value: number };
}

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

function hasRestoredPurchases(result: unknown): result is { restored: number } {
  return (
    typeof result === "object" &&
    result !== null &&
    "restored" in result &&
    typeof (result as { restored?: unknown }).restored === "number" &&
    (result as { restored: number }).restored > 0
  );
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

  const [viewState, setViewState] = useState<ViewState>("ready");
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    refetch: subscriptionRefetch,
    state: subscriptionState,
    hadSubscription,
  } = useSubscription();
  const latestCompletedRenderQuery = useQuery({
    ...trpc.tryon.getLatestCompletedRender.queryOptions(),
    enabled: userId.length > 0,
  });

  const handlePurchaseError = useCallback(
    (error: { code?: unknown } | null) => {
      if (isUserCancelledPurchaseError(error)) {
        setViewState("declined");
        return;
      }
      setViewState("error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [],
  );

  const handleVerifySuccess = useCallback(() => {
    setViewState("success");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (completionTimerRef.current) {
      clearTimeout(completionTimerRef.current);
    }
    completionTimerRef.current = setTimeout(() => {
      void subscriptionRefetch();
      onSuccess(garmentId);
    }, 2000);
  }, [subscriptionRefetch, onSuccess, garmentId]);

  const handleVerifyError = useCallback(() => {
    setViewState("error");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

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
  } = useStoreKit({
    userId,
    onPurchaseError: handlePurchaseError,
    onVerifySuccess: handleVerifySuccess,
    onVerifyError: handleVerifyError,
  });

  // AC#8: Determine if showing resubscribe or free trial messaging
  const isExpiredSubscriber =
    subscriptionState === "free_no_credits" && hadSubscription;

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

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
    product?.subscriptionOffers as TrialOffer[] | undefined
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
    void purchase().catch(() => {
      setViewState("error");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
  }, [purchase]);

  const handleRestore = useCallback(async () => {
    const restoreResult = await restore()
      .then((result) => ({ ok: true as const, result }))
      .catch(() => ({ ok: false as const }));

    if (!restoreResult.ok) {
      showToast({
        message: "Could not restore purchases. Try again.",
        variant: "error",
      });
      return;
    }

    await subscriptionRefetch();
    if (hasRestoredPurchases(restoreResult.result)) {
      showToast({ message: "Subscription restored!", variant: "success" });
      onSuccess(garmentId);
    } else {
      showToast({
        message: "No previous purchases found",
        variant: "info",
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

  const heroImageSource: HeroImageSource = useMemo(() => {
    const latestRender = latestCompletedRenderQuery.data;
    if (!latestRender?.resultImageUrl) {
      return STOCK_BODY_PHOTO;
    }

    return {
      uri: `${getBaseUrl()}${latestRender.resultImageUrl}`,
      headers: getAuthHeaders(),
    };
  }, [latestCompletedRenderQuery.data]);

  if (displayState === "loading") {
    return <PaywallLoadingState />;
  }

  if (displayState === "productError") {
    return (
      <PaywallProductErrorState
        onClose={onClose}
        productLoadErrorMessage={productLoadError?.message}
        onRetryProducts={handleRetryProducts}
        onRestore={handleRestore}
      />
    );
  }

  if (displayState === "success") {
    return <PaywallSuccessState />;
  }

  if (displayState === "declined") {
    return <PaywallDeclinedState onClose={onClose} />;
  }

  if (displayState === "error") {
    return <PaywallErrorState onClose={onClose} onRetry={handleRetry} />;
  }

  const isProcessing = displayState === "processing";
  const isRestoringNow = displayState === "restoring";

  return (
    <PaywallReadyState
      onClose={onClose}
      benefits={BENEFITS}
      ctaLabel={ctaLabel}
      isProcessing={isProcessing}
      onPurchase={handlePurchase}
      isExpiredSubscriber={isExpiredSubscriber}
      displayPrice={product?.displayPrice}
      onRestore={handleRestore}
      isRestoringNow={isRestoringNow}
      heroImageSource={heroImageSource}
    />
  );
}

function PaywallLoadingState() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center">
        <Spinner />
      </View>
    </SafeAreaView>
  );
}

interface PaywallProductErrorStateProps {
  onClose: () => void;
  productLoadErrorMessage?: string;
  onRetryProducts: () => Promise<void>;
  onRestore: () => Promise<void>;
}

function PaywallProductErrorState({
  onClose,
  productLoadErrorMessage,
  onRetryProducts,
  onRestore,
}: PaywallProductErrorStateProps) {
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
          {productLoadErrorMessage ??
            "Try again in a moment or restore an existing subscription."}
        </ThemedText>
        <View className="w-full gap-3">
          <Button label="Retry" onPress={() => void onRetryProducts()} />
          <Button
            label="Restore Purchases"
            variant="secondary"
            onPress={() => void onRestore()}
          />
          <Button label="Back to wardrobe" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PaywallSuccessState() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <CircleCheck size={64} color={wearbloomTheme.colors.success} />
        <ThemedText variant="display">Welcome!</ThemedText>
        <ThemedText variant="body" className="text-center text-text-secondary">
          Try on anything, anytime.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

function PaywallDeclinedState({ onClose }: { onClose: () => void }) {
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

interface PaywallErrorStateProps {
  onClose: () => void;
  onRetry: () => void;
}

function PaywallErrorState({ onClose, onRetry }: PaywallErrorStateProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <CloseButton onClose={onClose} />
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <ThemedText variant="body" className="text-center text-error">
          Something went wrong. Try again.
        </ThemedText>
        <Button label="Try again" onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

interface PaywallReadyStateProps {
  onClose: () => void;
  benefits: readonly string[];
  ctaLabel: string;
  isProcessing: boolean;
  onPurchase: () => void;
  isExpiredSubscriber: boolean;
  displayPrice?: string;
  onRestore: () => Promise<void>;
  isRestoringNow: boolean;
  heroImageSource: HeroImageSource;
}

function PaywallReadyState({
  onClose,
  benefits,
  ctaLabel,
  isProcessing,
  onPurchase,
  isExpiredSubscriber,
  displayPrice,
  onRestore,
  isRestoringNow,
  heroImageSource,
}: PaywallReadyStateProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <CloseButton onClose={onClose} />

      <ScrollView
        className="flex-1 p-6"
        contentContainerClassName="flex-grow justify-center pb-8 pt-12"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 overflow-hidden rounded-2xl">
          <Image
            source={heroImageSource}
            style={{ height: 192, width: "100%" }}
            contentFit="cover"
            transition={200}
            accessibilityRole="image"
            accessibilityLabel="Your try-on result preview"
          />
          <View className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1">
            <ThemedText variant="small" className="text-white">
              Your try-on result preview
            </ThemedText>
          </View>
        </View>

        <ThemedText variant="display" className="mb-6">
          Unlimited Try-Ons
        </ThemedText>

        <View className="mb-6 gap-3">
          {benefits.map((benefit) => (
            <View key={benefit} className="flex-row items-center gap-3">
              <Check size={20} color={wearbloomTheme.colors["text-primary"]} />
              <ThemedText variant="body">{benefit}</ThemedText>
            </View>
          ))}
        </View>

        <Button
          label={isProcessing ? "Confirming..." : ctaLabel}
          onPress={onPurchase}
          isLoading={isProcessing}
          disabled={isProcessing}
        />

        {Platform.OS === "ios" ? (
          <View className="mt-3 flex-row items-center justify-center gap-2">
            <ThemedText variant="caption" className="text-text-secondary">
              Fast checkout with
            </ThemedText>
            <View className="rounded-md bg-black px-2.5 py-1">
              <ThemedText variant="small" className="font-semibold text-white">
                Apple Pay
              </ThemedText>
            </View>
          </View>
        ) : null}

        <ThemedText
          variant="caption"
          className="mt-3 text-center text-text-secondary"
        >
          {isExpiredSubscriber
            ? `${displayPrice ?? "\u2026"}/week. Auto-renews weekly. Cancel anytime.`
            : `Then ${displayPrice ?? "\u2026"}/week. Auto-renews weekly. Cancel anytime.`}
        </ThemedText>

        <ThemedPressable
          className="mt-4 items-center py-2"
          onPress={() => void onRestore()}
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
