import AsyncStorage from "@react-native-async-storage/async-storage";

const HIDDEN_KEY = "hidden_stock_garments";
const SHOW_KEY = "show_stock_garments";

export async function getHiddenStockGarmentIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(HIDDEN_KEY);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function hideStockGarment(id: string): Promise<void> {
  const ids = await getHiddenStockGarmentIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
  }
}

export async function unhideStockGarment(id: string): Promise<void> {
  const ids = await getHiddenStockGarmentIds();
  const filtered = ids.filter((i) => i !== id);
  await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify(filtered));
}

export async function unhideAllStockGarments(): Promise<void> {
  await AsyncStorage.removeItem(HIDDEN_KEY);
}

export async function getShowStockGarments(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SHOW_KEY);
  if (value === null) return true;
  return value === "true";
}

export async function setShowStockGarments(show: boolean): Promise<void> {
  await AsyncStorage.setItem(SHOW_KEY, String(show));
}
