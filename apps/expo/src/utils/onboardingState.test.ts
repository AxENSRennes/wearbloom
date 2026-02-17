import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  getOnboardingBodyPhotoSource,
  hasCompletedOnboarding,
  markOnboardingComplete,
  setOnboardingBodyPhotoSource,
} from "./onboardingState";

describe("onboardingState", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  test("hasCompletedOnboarding returns false initially", async () => {
    const result = await hasCompletedOnboarding();
    expect(result).toBe(false);
  });

  test("markOnboardingComplete sets flag", async () => {
    await markOnboardingComplete();
    const result = await hasCompletedOnboarding();
    expect(result).toBe(true);
  });

  test("hasCompletedOnboarding returns true after marking complete", async () => {
    expect(await hasCompletedOnboarding()).toBe(false);
    await markOnboardingComplete();
    expect(await hasCompletedOnboarding()).toBe(true);
  });
});

describe("onboardingBodyPhotoSource", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  test("getOnboardingBodyPhotoSource returns null when not set", async () => {
    const result = await getOnboardingBodyPhotoSource();
    expect(result).toBeNull();
  });

  test("setOnboardingBodyPhotoSource stores 'stock'", async () => {
    await setOnboardingBodyPhotoSource("stock");
    const result = await getOnboardingBodyPhotoSource();
    expect(result).toBe("stock");
  });

  test("setOnboardingBodyPhotoSource stores 'own'", async () => {
    await setOnboardingBodyPhotoSource("own");
    const result = await getOnboardingBodyPhotoSource();
    expect(result).toBe("own");
  });

  test("setOnboardingBodyPhotoSource overwrites previous value", async () => {
    await setOnboardingBodyPhotoSource("stock");
    expect(await getOnboardingBodyPhotoSource()).toBe("stock");
    await setOnboardingBodyPhotoSource("own");
    expect(await getOnboardingBodyPhotoSource()).toBe("own");
  });
});
