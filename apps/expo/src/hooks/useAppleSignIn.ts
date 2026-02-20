import type { Href } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { showToast } from "@acme/ui";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const DEFAULT_NON_BLOCKING_TIMEOUT_MS = 4000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      const timerId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      promise
        .finally(() => clearTimeout(timerId))
        .catch(() => {
          clearTimeout(timerId);
        });
    }),
  ]);
}

export function useAppleSignIn(options?: {
  onSuccess?: () => void | Promise<void>;
  grantCredits?: boolean;
  maxWaitMs?: number;
}) {
  const router = useRouter();
  const grantCredits = useMutation(
    trpc.subscription.grantInitialCredits.mutationOptions(),
  );

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
      const shouldGrantCredits = options?.grantCredits ?? true;
      const timeoutMs = options?.maxWaitMs ?? DEFAULT_NON_BLOCKING_TIMEOUT_MS;

      if (shouldGrantCredits) {
        void withTimeout(
          grantCredits.mutateAsync(),
          timeoutMs,
          "Grant credits request timed out",
        ).catch(() => {
          // Non-critical — idempotent grant, credits may already exist
        });
      }

      if (options?.onSuccess) {
        try {
          await withTimeout(
            Promise.resolve(options.onSuccess()),
            timeoutMs,
            "Post-auth success flow timed out",
          );
        } catch {
          router.replace("/(auth)/(tabs)" as Href);
        }
      } else {
        router.replace("/(auth)/(tabs)" as Href);
      }
    },
    onError: (error: Error) => {
      const message = error.message.toLowerCase();
      if (
        message.includes("canceled") ||
        message.includes("cancelled") ||
        message.includes("err_request_canceled")
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
