import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { Redirect, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { ToastProvider } from "@acme/ui";

import { queryClient } from "~/utils/api";
import { hasAcceptedConsent } from "~/utils/consent-store";
import { clientPersister } from "~/utils/queryPersister";

import "../styles.css";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [consented, setConsented] = useState(() => hasAcceptedConsent());

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

  // Re-sync with SecureStore after navigation (e.g., returning from consent screen)
  if (!consented && hasAcceptedConsent()) {
    setConsented(true);
  }

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
          <Slot />
        </ToastProvider>
        <StatusBar style="dark" />
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
