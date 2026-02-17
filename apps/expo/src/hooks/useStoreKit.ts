import type { ExpoPurchaseError, Purchase } from "expo-iap";
import { useCallback, useEffect, useState } from "react";
import {
  getAvailablePurchases as fetchPurchasesFromStore,
  useIAP,
} from "expo-iap";
import { useMutation } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";

const SUBSCRIPTION_SKU = "com.wearbloom.weekly";
type ProductLoadState = "idle" | "loading" | "ready" | "error";

function toError(value: unknown) {
  if (value instanceof Error) return value;
  return new Error("STOREKIT_PRODUCTS_UNAVAILABLE");
}

export function useStoreKit({ userId }: { userId: string }) {
  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    restorePurchases,
  } = useIAP({
    onPurchaseSuccess: (purchase) => {
      void handlePurchaseComplete(purchase);
    },
    onPurchaseError: (error) => {
      setPurchaseError(error);
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
      },
    }),
  );

  const restoreMutation = useMutation(
    trpc.subscription.restorePurchases.mutationOptions(),
  );

  const retryProductFetch = useCallback(async () => {
    if (!connected) return;

    setProductLoadState("loading");
    setProductLoadError(null);
    try {
      await fetchProducts({ skus: [SUBSCRIPTION_SKU], type: "subs" });
      setProductLoadState("ready");
    } catch (error) {
      setProductLoadState("error");
      setProductLoadError(toError(error));
    }
  }, [connected, fetchProducts]);

  // Fetch subscription product when StoreKit connection becomes available
  useEffect(() => {
    if (!connected) {
      setProductLoadState("idle");
      setProductLoadError(null);
      return;
    }

    if (productLoadState === "idle") {
      void retryProductFetch();
    }
  }, [connected, productLoadState, retryProductFetch]);

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
    const purchases = await fetchPurchasesFromStore();
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
  }, [restorePurchases, restoreMutation]);

  return {
    connected,
    isReady: productLoadState === "ready",
    productLoadState,
    productLoadError,
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
