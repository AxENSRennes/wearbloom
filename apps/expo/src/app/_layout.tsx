import type { Href } from "expo-router";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { Redirect, Slot, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  DMSerifDisplay_400Regular,
  useFonts,
} from "@expo-google-fonts/dm-serif-display";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { ToastProvider } from "@acme/ui";

import { queryClient } from "~/utils/api";
import {
  hasAcceptedConsent,
  hasAcceptedConsentSync,
} from "~/utils/consent-store";
import { hasCompletedOnboarding } from "~/utils/onboardingState";
import { clientPersister } from "~/utils/queryPersister";

import "../styles.css";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname();
  const initialConsent = hasAcceptedConsentSync();
  const [consentState, setConsentState] = useState(() => ({
    consented: initialConsent === true,
    resolved: initialConsent !== null,
  }));
  // null = still loading; false = not completed; true = completed
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) {
        console.warn("Failed to load DM Serif Display font:", fontError);
      }
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Load onboarding state (async)
  useEffect(() => {
    void hasCompletedOnboarding().then(setOnboardingDone);
  }, []);

  // Re-sync consent state after navigation (e.g., returning from consent screen).
  useEffect(() => {
    let cancelled = false;
    void hasAcceptedConsent()
      .then((accepted) => {
        if (cancelled) return;
        setConsentState({ consented: accepted, resolved: true });
      })
      .catch(() => {
        if (cancelled) return;
        setConsentState({ consented: false, resolved: true });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Determine onboarding redirect: only redirect when state is fully resolved to false
  const showOnboardingRedirect =
    consentState.consented && onboardingDone === false;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: clientPersister,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => query.state.status === "success",
            },
          }}
        >
          <ToastProvider>
            {consentState.resolved && !consentState.consented && (
              <Redirect href={"/(public)/consent" as Href} />
            )}
            {showOnboardingRedirect && (
              <Redirect href={"/(onboarding)" as Href} />
            )}
            <Slot />
          </ToastProvider>
          <StatusBar style="dark" />
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
