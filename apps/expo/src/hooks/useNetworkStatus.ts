import { useEffect, useRef } from "react";
import { useNetInfo } from "@react-native-community/netinfo";

interface UseNetworkStatusOptions {
  onReconnect?: () => void;
}

export function useNetworkStatus(options?: UseNetworkStatusOptions) {
  const netInfo = useNetInfo();
  const wasOffline = useRef(false);

  const isConnected = netInfo.isConnected ?? true;
  const isInternetReachable = netInfo.isInternetReachable ?? true;

  useEffect(() => {
    if (wasOffline.current && isConnected) {
      options?.onReconnect?.();
    }
    wasOffline.current = !isConnected;
  }, [isConnected, options]);

  return { isConnected, isInternetReachable };
}
