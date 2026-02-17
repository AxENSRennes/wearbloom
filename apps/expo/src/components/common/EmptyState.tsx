import { View } from "react-native";

import { Button, ThemedText } from "@acme/ui";

interface EmptyStateProps {
  headline: string;
  subtext?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function EmptyState({ headline, subtext, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <ThemedText variant="heading">{headline}</ThemedText>
      {subtext ? (
        <ThemedText variant="body" className="mt-2 text-text-secondary">
          {subtext}
        </ThemedText>
      ) : null}
      {ctaLabel ? (
        <View className="mt-6">
          <Button variant="secondary" label={ctaLabel} onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}
