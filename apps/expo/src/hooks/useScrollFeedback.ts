import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";

const SCROLL_EPSILON = 1;
const DRAG_ATTEMPT_THROTTLE_MS = 120;

export interface ScrollFeedbackEvent {
  screen: string;
  type: "scroll" | "drag_attempt";
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
  edge: "top" | "bottom" | "none";
  timestamp: number;
}

export interface ScrollMetrics {
  offsetY: number;
  contentHeight: number;
  viewportHeight: number;
}

export interface ScrollFeedbackState extends ScrollMetrics {
  canScroll: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
}

interface UseScrollFeedbackOptions {
  screen: string;
  enabled?: boolean;
  onEvent?: (event: ScrollFeedbackEvent) => void;
}

interface ScrollFeedbackHandlers {
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (_width: number, height: number) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

interface ScrollContainerHandlers {
  onTouchMove: () => void;
}

export interface UseScrollFeedbackResult {
  scrollProps: ScrollFeedbackHandlers;
  containerProps: ScrollContainerHandlers;
  state: ScrollFeedbackState;
}

function sanitizeOffset(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function sanitizeSize(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function getMaxOffset(metrics: ScrollMetrics) {
  return Math.max(0, metrics.contentHeight - metrics.viewportHeight);
}

export function resolveScrollEdge(metrics: ScrollMetrics) {
  const maxOffset = getMaxOffset(metrics);
  if (metrics.offsetY <= SCROLL_EPSILON) return "top" as const;
  if (maxOffset - metrics.offsetY <= SCROLL_EPSILON) return "bottom" as const;
  return "none" as const;
}

export function computeScrollState(
  metrics: ScrollMetrics,
): ScrollFeedbackState {
  const offsetY = sanitizeOffset(metrics.offsetY);
  const contentHeight = sanitizeSize(metrics.contentHeight);
  const viewportHeight = sanitizeSize(metrics.viewportHeight);
  const maxOffset = Math.max(0, contentHeight - viewportHeight);
  const clampedOffset = Math.min(offsetY, maxOffset);
  const canScroll = maxOffset > SCROLL_EPSILON;
  const isAtTop = clampedOffset <= SCROLL_EPSILON;
  const isAtBottom = maxOffset - clampedOffset <= SCROLL_EPSILON;

  return {
    offsetY: clampedOffset,
    contentHeight,
    viewportHeight,
    canScroll,
    isAtTop,
    isAtBottom,
  };
}

export function useScrollFeedback({
  screen,
  enabled = true,
  onEvent,
}: UseScrollFeedbackOptions): UseScrollFeedbackResult {
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    offsetY: 0,
    contentHeight: 0,
    viewportHeight: 0,
  });
  const metricsRef = useRef(metrics);
  const dragStartOffsetRef = useRef(0);
  const dragMovedRef = useRef(false);
  const lastAttemptTsRef = useRef(0);

  const updateMetrics = useCallback((nextMetrics: ScrollMetrics) => {
    metricsRef.current = nextMetrics;
    setMetrics(nextMetrics);
  }, []);

  const emitEvent = useCallback(
    (type: ScrollFeedbackEvent["type"], currentMetrics: ScrollMetrics) => {
      if (!enabled) return;
      onEvent?.({
        screen,
        type,
        offsetY: sanitizeOffset(currentMetrics.offsetY),
        contentHeight: sanitizeSize(currentMetrics.contentHeight),
        viewportHeight: sanitizeSize(currentMetrics.viewportHeight),
        edge: resolveScrollEdge(computeScrollState(currentMetrics)),
        timestamp: Date.now(),
      });
    },
    [enabled, onEvent, screen],
  );

  const maybeEmitDragAttempt = useCallback(() => {
    const now = Date.now();
    if (now - lastAttemptTsRef.current < DRAG_ATTEMPT_THROTTLE_MS) return;
    lastAttemptTsRef.current = now;
    emitEvent("drag_attempt", metricsRef.current);
  }, [emitEvent]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextMetrics: ScrollMetrics = {
        ...metricsRef.current,
        viewportHeight: event.nativeEvent.layout.height,
      };
      updateMetrics(nextMetrics);
    },
    [updateMetrics],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const nextMetrics: ScrollMetrics = {
        ...metricsRef.current,
        contentHeight: height,
      };
      updateMetrics(nextMetrics);
    },
    [updateMetrics],
  );

  const onScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      dragStartOffsetRef.current = sanitizeOffset(offsetY);
      dragMovedRef.current = false;

      const nextMetrics: ScrollMetrics = {
        ...metricsRef.current,
        offsetY,
      };
      updateMetrics(nextMetrics);
    },
    [updateMetrics],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const nextMetrics: ScrollMetrics = {
        ...metricsRef.current,
        offsetY,
      };
      if (
        Math.abs(sanitizeOffset(offsetY) - dragStartOffsetRef.current) >
        SCROLL_EPSILON
      ) {
        dragMovedRef.current = true;
      }
      updateMetrics(nextMetrics);
      emitEvent("scroll", nextMetrics);
    },
    [emitEvent, updateMetrics],
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const nextMetrics: ScrollMetrics = {
        ...metricsRef.current,
        offsetY,
      };
      updateMetrics(nextMetrics);
      if (!dragMovedRef.current) {
        maybeEmitDragAttempt();
      }
    },
    [maybeEmitDragAttempt, updateMetrics],
  );

  const onTouchMove = useCallback(() => {
    const state = computeScrollState(metricsRef.current);
    if (!state.canScroll || state.isAtTop || state.isAtBottom) {
      maybeEmitDragAttempt();
    }
  }, [maybeEmitDragAttempt]);

  const state = useMemo(() => computeScrollState(metrics), [metrics]);

  return {
    scrollProps: {
      onLayout,
      onContentSizeChange,
      onScroll,
      onScrollBeginDrag,
      onScrollEndDrag,
      scrollEventThrottle: 16,
    },
    containerProps: {
      onTouchMove,
    },
    state,
  };
}
