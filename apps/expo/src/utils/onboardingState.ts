import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "onboarding_completed";
const BODY_PHOTO_SOURCE_KEY = "onboarding_body_photo_source";

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

export async function setOnboardingBodyPhotoSource(
  source: "stock" | "own",
): Promise<void> {
  await AsyncStorage.setItem(BODY_PHOTO_SOURCE_KEY, source);
}

export async function getOnboardingBodyPhotoSource(): Promise<
  "stock" | "own" | null
> {
  const value = await AsyncStorage.getItem(BODY_PHOTO_SOURCE_KEY);
  if (value === "stock" || value === "own") return value;
  return null;
}
