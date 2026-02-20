import type { ReactElement } from "react";
import { View } from "react-native";

import { Button, ThemedText } from "@acme/ui";

interface EmptyStateProps {
  headline: string;
  subtext?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  illustration?: ReactElement;
  illustrationLabel?: string;
}

function DefaultEmptyStateIllustration({
  accessibilityLabel,
}: {
  accessibilityLabel: string;
}) {
  return (
    <View
      className="items-center"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="h-24 w-24 items-center justify-center rounded-full bg-surface">
        <View className="h-12 w-12 rounded-xl border border-border bg-background" />
      </View>
      <View className="-mt-2 h-3 w-20 rounded-full bg-accent-highlight-soft" />
    </View>
  );
}

export function EmptyState({
  headline,
  subtext,
  ctaLabel,
  onCtaPress,
  illustration,
  illustrationLabel = "Wardrobe empty state illustration",
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-5">
        {illustration ?? (
          <DefaultEmptyStateIllustration
            accessibilityLabel={illustrationLabel}
          />
        )}
      </View>
      <ThemedText variant="heading">{headline}</ThemedText>
      {subtext ? (
        <ThemedText
          variant="body"
          className="mt-2 text-center text-text-secondary"
        >
          {subtext}
        </ThemedText>
      ) : null}
      {ctaLabel ? (
        <View className="mt-6 w-full">
          <Button variant="secondary" label={ctaLabel} onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}
