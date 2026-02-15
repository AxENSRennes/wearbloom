import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { wearbloomTheme } from "./gluestack-config";

type ToastVariant = "success" | "error" | "info";

interface ToastConfig {
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastEntry extends ToastConfig {
  id: number;
}

export const VARIANT_STYLES: Record<ToastVariant, { borderColor: string; defaultDuration: number }> = {
  success: { borderColor: wearbloomTheme.colors.success, defaultDuration: 2000 },
  error: { borderColor: wearbloomTheme.colors.error, defaultDuration: 4000 },
  info: { borderColor: wearbloomTheme.colors["text-tertiary"], defaultDuration: 3000 },
};

let globalShow: ((config: ToastConfig) => void) | null = null;

export function showToast(config: ToastConfig) {
  globalShow?.(config);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastEntry | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const nextId = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [translateY]);

  const show = useCallback(
    (config: ToastConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const id = nextId.current++;
      const { defaultDuration } = VARIANT_STYLES[config.variant];
      const duration = config.duration ?? defaultDuration;

      setToast({ ...config, id });
      translateY.setValue(-100);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 150,
      }).start();

      timerRef.current = setTimeout(dismiss, duration);
    },
    [dismiss, translateY],
  );

  useEffect(() => {
    globalShow = show;
    return () => {
      globalShow = null;
    };
  }, [show]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast ? (
        <Animated.View
          style={{
            position: "absolute",
            top: 50,
            left: 16,
            right: 16,
            transform: [{ translateY }],
            zIndex: 9999,
          }}
        >
          <Pressable
            accessible
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
            onPress={dismiss}
            style={{
              backgroundColor: wearbloomTheme.colors.background,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderLeftWidth: 4,
              borderLeftColor: VARIANT_STYLES[toast.variant].borderColor,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text style={{ color: wearbloomTheme.colors["text-primary"], fontSize: 15, lineHeight: 22 }}>
              {toast.message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
