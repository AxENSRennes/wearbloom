import { describe, expect, test } from "bun:test";

describe("useOnboardingSignUp", () => {
  test("exports useOnboardingSignUp function", async () => {
    const mod = await import("./useOnboardingSignUp");
    expect(typeof mod.useOnboardingSignUp).toBe("function");
  });

  test("exports useOnboardingAppleSignIn function", async () => {
    const mod = await import("./useOnboardingSignUp");
    expect(typeof mod.useOnboardingAppleSignIn).toBe("function");
  });

  test("useOnboardingSignUp returns mutation-like object", async () => {
    const { useOnboardingSignUp } = await import("./useOnboardingSignUp");
    const result = useOnboardingSignUp();
    // Should return the email sign-up mutation from useMutation mock
    expect(result).toHaveProperty("mutate");
    expect(result).toHaveProperty("isPending");
  });

  test("useOnboardingAppleSignIn returns mutation-like object", async () => {
    const { useOnboardingAppleSignIn } = await import("./useOnboardingSignUp");
    const result = useOnboardingAppleSignIn();
    // Should return the apple sign-in mutation from useAppleSignIn mock
    expect(result).toHaveProperty("mutate");
    expect(result).toHaveProperty("isPending");
  });
});
