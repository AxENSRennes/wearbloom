import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@acme/ui";

import { trpc } from "~/utils/api";

interface CreditCounterProps {
  className?: string;
}

export function CreditCounter({ className }: CreditCounterProps) {
  const { data, isLoading } = useQuery(
    trpc.subscription.getSubscriptionStatus.queryOptions(),
  );

  if (isLoading || !data) {
    return null;
  }

  if (data.isSubscriber) {
    return null;
  }

  const label =
    data.creditsRemaining > 0
      ? `${data.creditsRemaining} free render${data.creditsRemaining !== 1 ? "s" : ""} left`
      : "Start free trial";

  const a11yLabel =
    data.creditsRemaining > 0
      ? `${data.creditsRemaining} free renders remaining`
      : "Start free trial";

  return (
    <ThemedText
      variant="caption"
      className={`text-text-secondary ${className ?? ""}`}
      accessible
      accessibilityLabel={a11yLabel}
    >
      {label}
    </ThemedText>
  );
}
