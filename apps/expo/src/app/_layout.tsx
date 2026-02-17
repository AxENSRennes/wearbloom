import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Redirect, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  DMSerifDisplay_400Regular,
  useFonts,
} from "@expo-google-fonts/dm-serif-display";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { ToastProvider } from "@acme/ui";

import { queryClient } from "~/utils/api";
import { hasAcceptedConsent } from "~/utils/consent-store";
import { hasCompletedOnboarding } from "~/utils/onboardingState";
import { clientPersister } from "~/utils/queryPersister";

import "../styles.css";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [consented, setConsented] = useState(() => hasAcceptedConsent());
  // null = still loading; false = not completed; true = completed
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) {
        if (__DEV__)
          console.warn("Failed to load DM Serif Display font:", fontError);
      }
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Load onboarding state (async)
  useEffect(() => {
    void hasCompletedOnboarding().then(setOnboardingDone);
  }, []);

  // Re-sync with SecureStore after navigation (e.g., returning from consent screen)
  if (!consented && hasAcceptedConsent()) {
    setConsented(true);
  }

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Determine onboarding redirect: only redirect when state is fully resolved to false
  const showOnboardingRedirect = consented && onboardingDone === false;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          {!consented && <Redirect href="/(public)/consent" />}
          {showOnboardingRedirect && <Redirect href="/(onboarding)" />}
          <Slot />
        </ToastProvider>
        <StatusBar style="dark" />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
