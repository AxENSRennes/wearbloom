import type { ComponentProps } from "react";
import { Platform, ScrollView } from "react-native";

import type { ScrollFeedbackEvent } from "~/hooks/useScrollFeedback";
import { useScrollFeedback } from "~/hooks/useScrollFeedback";

interface AppScrollViewProps extends ComponentProps<typeof ScrollView> {
  screen: string;
  scrollFeedbackEnabled?: boolean;
  onScrollFeedbackEvent?: (event: ScrollFeedbackEvent) => void;
}

function callAllHandlers<Args extends readonly unknown[]>(
  first: ((...args: Args) => void) | undefined,
  second: (...args: Args) => void,
) {
  return (...args: Args) => {
    first?.(...args);
    second(...args);
  };
}

export function AppScrollView({
  screen,
  scrollFeedbackEnabled = true,
  onScrollFeedbackEvent,
  scrollEventThrottle,
  onLayout,
  onContentSizeChange,
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  onTouchMove,
  ...props
}: AppScrollViewProps) {
  const { scrollProps, containerProps } = useScrollFeedback({
    screen,
    enabled: scrollFeedbackEnabled,
    onEvent: onScrollFeedbackEvent,
  });

  return (
    <ScrollView
      {...props}
      bounces={Platform.OS === "ios"}
      alwaysBounceVertical={Platform.OS === "ios"}
      overScrollMode="always"
      scrollEventThrottle={
        scrollEventThrottle ?? scrollProps.scrollEventThrottle
      }
      onLayout={callAllHandlers(onLayout, scrollProps.onLayout)}
      onContentSizeChange={callAllHandlers(
        onContentSizeChange,
        scrollProps.onContentSizeChange,
      )}
      onScroll={callAllHandlers(onScroll, scrollProps.onScroll)}
      onScrollBeginDrag={callAllHandlers(
        onScrollBeginDrag,
        scrollProps.onScrollBeginDrag,
      )}
      onScrollEndDrag={callAllHandlers(
        onScrollEndDrag,
        scrollProps.onScrollEndDrag,
      )}
      onTouchMove={callAllHandlers(onTouchMove, containerProps.onTouchMove)}
    />
  );
}
