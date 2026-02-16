import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  hasCompletedOnboarding,
  markOnboardingComplete,
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
