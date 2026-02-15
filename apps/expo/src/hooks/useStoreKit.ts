import { useCallback, useEffect, useState } from "react";
import {
  useIAP,
  getAvailablePurchases as fetchPurchasesFromStore,
} from "expo-iap";
import type { Purchase, ExpoPurchaseError } from "expo-iap";
import { useMutation } from "@tanstack/react-query";

import { trpc, queryClient } from "~/utils/api";

const SUBSCRIPTION_SKU = "com.wearbloom.weekly";

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

  const [isReady, setIsReady] = useState(false);
  const [purchaseError, setPurchaseError] =
    useState<ExpoPurchaseError | null>(null);

  const verifyMutation = useMutation(
    trpc.subscription.verifyPurchase.mutationOptions({
      onSuccess: () => {
        // Invalidate subscription queries after successful purchase
        void queryClient.invalidateQueries({
          queryKey: trpc.subscription.getStatus.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.subscription.getSubscriptionStatus.queryKey(),
        });
      },
    }),
  );

  const restoreMutation = useMutation(
    trpc.subscription.restorePurchases.mutationOptions(),
  );

  // Fetch subscription product on connect
  useEffect(() => {
    if (connected && !isReady) {
      fetchProducts({ skus: [SUBSCRIPTION_SKU], type: "subs" })
        .then(() => setIsReady(true))
        .catch(() => {
          // Product not configured yet in App Store Connect
          setIsReady(false);
        });
    }
  }, [connected, isReady, fetchProducts]);

  async function handlePurchaseComplete(purchase: Purchase) {
    try {
      // Server validates the transaction via JWS token
      await verifyMutation.mutateAsync({
        signedTransactionInfo: purchase.purchaseToken ?? "",
      });
      // Finish transaction with Apple after server confirms
      await finishTransaction({ purchase, isConsumable: false });
    } catch {
      // Purchase verification failed — transaction stays pending
      // Apple will present it again on next app launch
    }
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
  }, [requestPurchase, userId]);

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

    // Invalidate queries
    void queryClient.invalidateQueries({
      queryKey: trpc.subscription.getStatus.queryKey(),
    });

    return result;
  }, [restorePurchases, restoreMutation]);

  return {
    connected,
    isReady,
    product: subscriptions[0] ?? null,
    purchase,
    restore,
    isPurchasing: verifyMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError,
    verifyError: verifyMutation.error,
  };
}
