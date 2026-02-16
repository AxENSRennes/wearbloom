import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { showToast } from "@acme/ui";

import { useAppleSignIn } from "~/hooks/useAppleSignIn";
import { authClient } from "~/utils/auth";
import { markOnboardingComplete } from "~/utils/onboardingState";

/**
 * Wraps email sign-up mutation with onboarding finalization:
 * markOnboardingComplete() + navigate to main app.
 */
export function useOnboardingSignUp() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
    }) => {
      const result = await authClient.signUp.email(data);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: async () => {
      await markOnboardingComplete();
      // TODO(Story-1.5): Associate onboarding body photo with user profile after body avatar management is implemented
      // TODO(Epic-2): Stock garments should appear in wardrobe grid after wardrobe management is implemented
      // TODO(Story-4.1): Grant free render credits on account creation
      showToast({
        message: "Welcome! Your wardrobe is ready.",
        variant: "success",
      });
      router.replace("/(auth)/(tabs)");
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || "Sign up failed",
        variant: "error",
      });
    },
  });
}

/**
 * Wraps Apple Sign-In with onboarding finalization:
 * markOnboardingComplete() + navigate to main app.
 */
export function useOnboardingAppleSignIn() {
  const router = useRouter();
  const appleSignIn = useAppleSignIn();

  return {
    ...appleSignIn,
    mutate: () => {
      appleSignIn.mutate(undefined, {
        onSuccess: async () => {
          await markOnboardingComplete();
          showToast({
            message: "Welcome! Your wardrobe is ready.",
            variant: "success",
          });
          router.replace("/(auth)/(tabs)");
        },
      });
    },
  };
}
