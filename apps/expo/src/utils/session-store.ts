import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const key = "session_token";

export const getToken = () =>
  Platform.OS === "web"
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key).catch(() => AsyncStorage.getItem(key));

export const deleteToken = () =>
  Platform.OS === "web"
    ? AsyncStorage.removeItem(key)
    : SecureStore.deleteItemAsync(key).catch(() =>
        AsyncStorage.removeItem(key),
      );

export const setToken = (v: string) =>
  Platform.OS === "web"
    ? AsyncStorage.setItem(key, v)
    : SecureStore.setItemAsync(key, v).catch(() =>
        AsyncStorage.setItem(key, v),
      );
