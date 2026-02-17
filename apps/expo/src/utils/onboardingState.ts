import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "onboarding_completed";
const BODY_PHOTO_SOURCE_KEY = "onboarding_body_photo_source";
const OWN_BODY_PHOTO_URI_KEY = "onboarding_own_body_photo_uri";

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

export async function setOnboardingOwnBodyPhotoUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(OWN_BODY_PHOTO_URI_KEY, uri);
}

export async function getOnboardingOwnBodyPhotoUri(): Promise<string | null> {
  return AsyncStorage.getItem(OWN_BODY_PHOTO_URI_KEY);
}

export async function clearOnboardingOwnBodyPhotoUri(): Promise<void> {
  await AsyncStorage.removeItem(OWN_BODY_PHOTO_URI_KEY);
}
