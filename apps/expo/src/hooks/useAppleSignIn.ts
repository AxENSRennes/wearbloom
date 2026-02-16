import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { showToast } from "@acme/ui";

import { authClient } from "~/utils/auth";

export function useAppleSignIn(options?: {
  onSuccess?: () => void | Promise<void>;
}) {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("No identity token received from Apple");
      }
      const result = await authClient.signIn.social({
        provider: "apple",
        idToken: { token: credential.identityToken },
      });
      if (result.error) throw new Error(result.error.message);

      // Apple only returns fullName on the FIRST sign-in — capture it now
      if (credential.fullName) {
        const name = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(" ");
        if (name) {
          try {
            await authClient.updateUser({ name });
          } catch {
            // Non-critical: user created successfully but name update failed
          }
        }
      }

      return result.data;
    },
    onSuccess: async () => {
      if (options?.onSuccess) {
        await options.onSuccess();
      } else {
        router.replace("/(auth)/(tabs)");
      }
    },
    onError: (error: Error) => {
      if (
        error.message.includes("canceled") ||
        error.message.includes("ERR_REQUEST_CANCELED")
      ) {
        return;
      }
      showToast({
        message: error.message || "Apple sign in failed",
        variant: "error",
      });
    },
  });
}
