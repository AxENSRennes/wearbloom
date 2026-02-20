import type { ExpoPurchaseError, Purchase } from "expo-iap";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";

const SUBSCRIPTION_SKU = "com.wearbloom.weekly";
type ProductLoadState = "idle" | "loading" | "ready" | "error";
const WEB_STOREKIT_UNAVAILABLE_ERROR = new Error(
  "IN_APP_PURCHASES_NOT_SUPPORTED_ON_WEB",
);

type StoreKitProduct = Record<string, unknown> & { displayPrice?: string };

interface StoreKitAdapter {
  useIAP: (options: {
    onPurchaseSuccess?: (purchase: Purchase) => void;
    onPurchaseError?: (error: ExpoPurchaseError) => void;
  }) => {
    connected: boolean;
    subscriptions: StoreKitProduct[];
    fetchProducts: (input: { skus: string[]; type: "subs" }) => Promise<void>;
    requestPurchase: (input: {
      request: { apple: { sku: string; appAccountToken: string } };
      type: "subs";
    }) => Promise<void>;
    finishTransaction: (input: {
      purchase: Purchase;
      isConsumable: boolean;
    }) => Promise<void>;
    restorePurchases: () => Promise<void>;
  };
  getAvailablePurchases: () => Promise<{ purchaseToken?: string | null }[]>;
}

interface UseStoreKitOptions {
  userId: string;
  onPurchaseError?: (error: ExpoPurchaseError) => void;
  onVerifySuccess?: () => void;
  onVerifyError?: (error: Error) => void;
}

const webStoreKitAdapter: StoreKitAdapter = {
  useIAP: () => ({
    connected: false,
    subscriptions: [],
    fetchProducts: () => Promise.resolve(),
    requestPurchase: () => Promise.resolve(),
    finishTransaction: () => Promise.resolve(),
    restorePurchases: () => Promise.resolve(),
  }),
  getAvailablePurchases: () => Promise.resolve([]),
};

function getStoreKitAdapter() {
  if (Platform.OS === "web") return webStoreKitAdapter;

  // eslint-disable-next-line @typescript-eslint/no-require-imports -- expo-iap is native-only, so we load it lazily off web.
  return require("expo-iap") as StoreKitAdapter;
}

function toError(value: unknown) {
  if (value instanceof Error) return value;
  return new Error("STOREKIT_PRODUCTS_UNAVAILABLE");
}

export function useStoreKit({
  userId,
  onPurchaseError,
  onVerifySuccess,
  onVerifyError,
}: UseStoreKitOptions) {
  const isWeb = Platform.OS === "web";
  const storeKitAdapter = getStoreKitAdapter();
  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = storeKitAdapter.useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchaseComplete(purchase);
    },
    onPurchaseError: (error) => {
      setPurchaseError(error);
      onPurchaseError?.(error);
    },
  });

  const [productLoadState, setProductLoadState] =
    useState<ProductLoadState>("idle");
  const [productLoadError, setProductLoadError] = useState<Error | null>(null);
  const [purchaseError, setPurchaseError] = useState<ExpoPurchaseError | null>(
    null,
  );

  const verifyMutation = useMutation(
    trpc.subscription.verifyPurchase.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.subscription.getSubscriptionStatus.queryKey(),
        });
        onVerifySuccess?.();
      },
      onError: (error) => {
        onVerifyError?.(toError(error));
      },
    }),
  );

  const restoreMutation = useMutation(
    trpc.subscription.restorePurchases.mutationOptions(),
  );

  const retryProductFetch = useCallback(async () => {
    if (!connected || isWeb) return;

    setProductLoadState("loading");
    setProductLoadError(null);
    try {
      await fetchProducts({ skus: [SUBSCRIPTION_SKU], type: "subs" });
      setProductLoadState("ready");
    } catch (error) {
      setProductLoadState("error");
      setProductLoadError(toError(error));
    }
  }, [connected, fetchProducts, isWeb]);

  // Fetch subscription product when StoreKit connection becomes available
  useEffect(() => {
    if (!connected || productLoadState !== "idle" || isWeb) return;
    const timeoutId = setTimeout(() => {
      void retryProductFetch();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [connected, isWeb, productLoadState, retryProductFetch]);

  async function handlePurchaseComplete(purchase: Purchase) {
    // Server validates the transaction via JWS token.
    // If this rejects, the mutation enters error state (verifyError)
    // and finishTransaction is skipped — the unfinished transaction
    // stays pending so Apple will present it again on next app launch.
    await verifyMutation.mutateAsync({
      signedTransactionInfo: purchase.purchaseToken ?? "",
    });
    // Finish transaction with Apple only after server confirms
    await finishTransaction({ purchase, isConsumable: false });
  }

  const purchase = useCallback(async () => {
    setPurchaseError(null);
    await requestPurchase({
      request: {
        apple: {
          sku: SUBSCRIPTION_SKU,
          appAccountToken: userId,
        },
      },
      type: "subs",
    });
  }, [setPurchaseError, requestPurchase, userId]);

  const restore = useCallback(async () => {
    // Sync with Apple then fetch available purchases (root API returns data)
    await restorePurchases();
    const purchases = await storeKitAdapter.getAvailablePurchases();
    if (purchases.length === 0) return { restored: 0 };

    const result = await restoreMutation.mutateAsync({
      signedTransactions: purchases
        .map((p) => p.purchaseToken)
        .filter((t): t is string => t != null),
    });

    void queryClient.invalidateQueries({
      queryKey: trpc.subscription.getSubscriptionStatus.queryKey(),
    });

    return result;
  }, [restorePurchases, restoreMutation, storeKitAdapter]);

  return {
    connected,
    isReady: connected && productLoadState === "ready",
    productLoadState: isWeb ? "error" : connected ? productLoadState : "idle",
    productLoadError: isWeb
      ? WEB_STOREKIT_UNAVAILABLE_ERROR
      : connected
        ? productLoadError
        : null,
    retryProductFetch,
    product: subscriptions[0] ?? null,
    purchase,
    restore,
    isPurchasing: verifyMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError,
    verifyError: verifyMutation.error,
  };
}
