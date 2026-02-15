import { useEffect, useState } from "react";
import { useFonts, DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { Redirect, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { ToastProvider } from "@acme/ui";

import { queryClient } from "~/utils/api";
import { hasAcceptedConsent } from "~/utils/consent-store";

import "../styles.css";

SplashScreen.preventAutoHideAsync();

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
      SplashScreen.hideAsync();
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
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {!consented && <Redirect href="/(public)/consent" />}
        <Slot />
      </ToastProvider>
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
