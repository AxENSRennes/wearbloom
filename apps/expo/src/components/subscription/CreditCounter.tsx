import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { cn, ThemedPressable, ThemedText } from "@acme/ui";

import { trpc } from "~/utils/api";

interface CreditCounterProps {
  className?: string;
}

export function CreditCounter({ className }: CreditCounterProps) {
  const router = useRouter();
  const { data, isLoading } = useQuery(
    trpc.subscription.getSubscriptionStatus.queryOptions(),
  );

  if (isLoading || !data) {
    return null;
  }

  if (data.isSubscriber) {
    return null;
  }

  if (data.creditsRemaining === 0) {
    return (
      <ThemedPressable
        onPress={() => {
          router.push("/(auth)/paywall" as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel="Start free trial"
        accessibilityHint="Opens subscription options"
      >
        <ThemedText variant="caption" className={cn("text-accent", className)}>
          Start free trial
        </ThemedText>
      </ThemedPressable>
    );
  }

  return (
    <ThemedText
      variant="caption"
      className={cn("text-text-secondary", className)}
      accessible
      accessibilityLabel={`${data.creditsRemaining} free renders remaining`}
    >
      {`${data.creditsRemaining} free render${data.creditsRemaining !== 1 ? "s" : ""} left`}
    </ThemedText>
  );
}
