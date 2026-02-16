import { useEffect, useRef } from "react";
import { useNetInfo } from "@react-native-community/netinfo";

interface UseNetworkStatusOptions {
  onReconnect?: () => void;
}

export function useNetworkStatus(options?: UseNetworkStatusOptions) {
  const netInfo = useNetInfo();
  const wasOffline = useRef(false);
  const onReconnectRef = useRef(options?.onReconnect);

  useEffect(() => {
    onReconnectRef.current = options?.onReconnect;
  }, [options?.onReconnect]);

  const isConnected = netInfo.isConnected ?? true;
  const isInternetReachable = netInfo.isInternetReachable ?? true;

  useEffect(() => {
    if (wasOffline.current && isConnected) {
      onReconnectRef.current?.();
    }
    wasOffline.current = !isConnected;
  }, [isConnected]);

  return { isConnected, isInternetReachable };
}
