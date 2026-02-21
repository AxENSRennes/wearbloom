import type { Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button, showToast, ThemedText } from "@acme/ui";

import { SafeScreen } from "~/components/common/SafeScreen";
import { RenderCompletedView } from "~/components/tryon/RenderCompletedView";
import { RenderLoadingAnimation } from "~/components/tryon/RenderLoadingAnimation";
import { trpc } from "~/utils/api";
import { getAuthHeaders } from "~/utils/authHeaders";
import { getBaseUrl } from "~/utils/base-url";

const MAX_POLLS = 15;

export default function RenderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const pollCount = useRef(0);
  const mountTime = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const hapticFired = useRef(false);

  const { data } = useQuery({
    ...trpc.tryon.getRenderStatus.queryOptions({ renderId: id }),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      if (pollCount.current >= MAX_POLLS) return false;
      pollCount.current++;
      return 2000;
    },
  });

  const requestRenderMutation = useMutation(
    trpc.tryon.requestRender.mutationOptions({
      onSuccess: (newData) => {
        router.replace(`/render/${newData.renderId}` as Href);
      },
    }),
  );

  const submitFeedbackMutation = useMutation(
    trpc.tryon.submitFeedback.mutationOptions({
      onSuccess: (result) => {
        if (result.creditRefunded) {
          showToast({
            message: "Thanks for feedback. Render not counted.",
            variant: "success",
          });
        } else {
          showToast({
            message: "Thanks for your feedback!",
            variant: "success",
          });
        }
      },
      onError: () => {
        showToast({
          message: "Couldn't submit feedback. Try again.",
          variant: "error",
        });
      },
    }),
  );

  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  const handleFeedbackSubmit = useCallback(
    (rating: "thumbs_up" | "thumbs_down", category?: string) => {
      submitFeedbackMutation.mutate({ renderId: id, rating, category });
    },
    [submitFeedbackMutation, id],
  );

  const status = data?.status ?? "pending";

  // Capture mount timestamp in effect (Date.now is impure, cannot be called during render)
  useEffect(() => {
    mountTime.current = Date.now();
  }, []);

  // Elapsed time tracker for loading animation
  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const interval = setInterval(() => {
      setElapsedMs(Date.now() - mountTime.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Haptic feedback on status change
  useEffect(() => {
    if (hapticFired.current) return;

    if (status === "completed") {
      hapticFired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (status === "failed") {
      hapticFired.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [status]);

  // Auth headers for image loading
  const imageHeaders = getAuthHeaders();

  // --- LOADING STATE ---
  if (status === "pending" || status === "processing") {
    return (
      <SafeScreen className="bg-black">
        <StatusBar style="light" />
        <RenderLoadingAnimation
          personImageUrl={
            data?.personImageUrl ? `${getBaseUrl()}${data.personImageUrl}` : ""
          }
          garmentImageUrl={
            data?.garmentImageUrl
              ? `${getBaseUrl()}${data.garmentImageUrl}`
              : null
          }
          elapsedMs={elapsedMs}
          imageHeaders={imageHeaders}
        />
      </SafeScreen>
    );
  }

  // --- FAILED STATE ---
  if (status === "failed") {
    return (
      <SafeScreen
        className="bg-black"
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <StatusBar style="light" />
        <ThemedText
          variant="body"
          style={{ color: "white", textAlign: "center", marginBottom: 24 }}
        >
          This one didn't work. No render counted.
        </ThemedText>
        <Button
          variant="secondary"
          label="Try Again"
          onPress={() => {
            if (data?.garmentId) {
              requestRenderMutation.mutate({ garmentId: data.garmentId });
            }
          }}
          isLoading={requestRenderMutation.isPending}
        />
        <View style={{ marginTop: 12 }}>
          <Button
            variant="ghost"
            label="Back to Wardrobe"
            onPress={() => router.back()}
          />
        </View>
      </SafeScreen>
    );
  }

  // --- COMPLETED STATE ---
  return (
    <RenderCompletedView
      personImageUrl={data?.personImageUrl}
      resultImageUrl={data?.resultImageUrl}
      imageHeaders={imageHeaders}
      reducedMotion={reducedMotion}
      feedbackDismissed={feedbackDismissed}
      onFeedbackSubmit={handleFeedbackSubmit}
      onFeedbackDismiss={() => setFeedbackDismissed(true)}
      isSubmittingFeedback={submitFeedbackMutation.isPending}
    />
  );
}
