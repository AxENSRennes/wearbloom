import type { Href } from "expo-router";
import { useReducer } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react-native";

import { Button, showToast, ThemedText, wearbloomTheme } from "@acme/ui";

import { AppScrollView } from "~/components/common/AppScrollView";
import { SafeScreen } from "~/components/common/SafeScreen";
import { useAppleSignIn } from "~/hooks/useAppleSignIn";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { appendLocalImage } from "~/utils/formData";
import { compressImage } from "~/utils/imageCompressor";
import {
  clearOnboardingOwnBodyPhotoUri,
  getOnboardingBodyPhotoSource,
  getOnboardingOwnBodyPhotoUri,
  markOnboardingComplete,
} from "~/utils/onboardingState";
import { uploadStockBodyPhoto } from "~/utils/stockBodyPhotoUpload";

const PLACEHOLDER_COLOR = wearbloomTheme.colors["text-tertiary"];

type SignUpField = "name" | "email" | "password";

interface SignUpFormState {
  name: string;
  email: string;
  password: string;
  errors: Record<SignUpField, string>;
}

type SignUpFormAction =
  | { type: "SET_FIELD"; field: SignUpField; value: string }
  | { type: "SET_ERROR"; field: SignUpField; value: string }
  | { type: "SET_ERRORS"; errors: Record<SignUpField, string> };

const initialSignUpFormState: SignUpFormState = {
  name: "",
  email: "",
  password: "",
  errors: {
    name: "",
    email: "",
    password: "",
  },
};

function signUpFormReducer(
  state: SignUpFormState,
  action: SignUpFormAction,
): SignUpFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ERROR":
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.value },
      };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
  }
}

export default function SignUpScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isFromOnboarding = from === "onboarding";

  const [formState, dispatchForm] = useReducer(
    signUpFormReducer,
    initialSignUpFormState,
  );

  const grantCredits = useMutation(
    trpc.subscription.grantInitialCredits.mutationOptions(),
  );

  const emailSignUp = useMutation({
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
      await completeSignUpFlow();
    },
    onError: (error: Error) => {
      const msg = error.message;
      let userMessage = "Sign up failed. Please try again.";
      if (
        msg.includes("already") ||
        msg.includes("exists") ||
        msg.includes("UNIQUE")
      ) {
        userMessage = "An account with this email already exists";
      } else if (
        msg.includes("network") ||
        msg.includes("connection") ||
        msg.includes("fetch")
      ) {
        userMessage = "Connection lost. Try again.";
      }
      showToast({ message: userMessage, variant: "error" });
    },
  });

  const uploadBodyPhoto = useMutation(
    trpc.user.uploadBodyPhoto.mutationOptions(),
  );

  async function completeSignUpFlow(options?: { skipCreditGrant?: boolean }) {
    let requiresBodyPhoto = false;

    if (isFromOnboarding) {
      const source = await getOnboardingBodyPhotoSource();
      if (source === "own") {
        const onboardingPhotoUri = await getOnboardingOwnBodyPhotoUri();
        if (!onboardingPhotoUri) {
          requiresBodyPhoto = true;
          await clearOnboardingOwnBodyPhotoUri();
        } else {
          try {
            const compressed = await compressImage(onboardingPhotoUri);
            const formData = new FormData();
            await appendLocalImage(
              formData,
              "photo",
              compressed.uri,
              "body-avatar.jpg",
            );
            formData.append("width", String(compressed.width));
            formData.append("height", String(compressed.height));
            await uploadBodyPhoto.mutateAsync(formData);
            await clearOnboardingOwnBodyPhotoUri();
          } catch {
            requiresBodyPhoto = true;
            await clearOnboardingOwnBodyPhotoUri();
          }
        }
      } else if (source === "stock") {
        const result = await uploadStockBodyPhoto({
          uploadBodyPhoto: uploadBodyPhoto.mutateAsync,
        });
        if (!result.success) {
          showToast({
            message:
              "We'll finish setting up your example photo on your first try-on.",
            variant: "info",
          });
        }
        await clearOnboardingOwnBodyPhotoUri();
      } else {
        await clearOnboardingOwnBodyPhotoUri();
      }

      await markOnboardingComplete();
    }

    if (!options?.skipCreditGrant) {
      try {
        await grantCredits.mutateAsync();
      } catch {
        showToast({
          message: "Credits will be granted later",
          variant: "info",
        });
      }
    }

    if (requiresBodyPhoto) {
      showToast({
        message: "Add your body photo to continue.",
        variant: "info",
      });
      router.replace("/(auth)/body-photo" as Href);
      return;
    }

    showToast({
      message: "Welcome! Your wardrobe is ready.",
      variant: "success",
    });
    router.replace("/(auth)/(tabs)" as Href);
  }

  const appleSignIn = useAppleSignIn(
    isFromOnboarding
      ? {
          grantCredits: false,
          onSuccess: async () => {
            await completeSignUpFlow({ skipCreditGrant: true });
          },
        }
      : undefined,
  );

  const isLoading = emailSignUp.isPending || appleSignIn.isPending;

  const validateName = (value: string) => {
    if (!value.trim()) return "Name is required";
    return "";
  };

  const validateEmail = (value: string) => {
    if (!value) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(value)) return "Invalid email format";
    return "";
  };

  const validatePassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 8) return "Password must be at least 8 characters";
    return "";
  };

  const handleNameChange = (value: string) => {
    dispatchForm({ type: "SET_FIELD", field: "name", value });
    if (formState.errors.name) {
      dispatchForm({
        type: "SET_ERROR",
        field: "name",
        value: validateName(value),
      });
    }
  };

  const handleEmailChange = (value: string) => {
    dispatchForm({ type: "SET_FIELD", field: "email", value });
    if (formState.errors.email) {
      dispatchForm({
        type: "SET_ERROR",
        field: "email",
        value: validateEmail(value),
      });
    }
  };

  const handlePasswordChange = (value: string) => {
    dispatchForm({ type: "SET_FIELD", field: "password", value });
    if (formState.errors.password) {
      dispatchForm({
        type: "SET_ERROR",
        field: "password",
        value: validatePassword(value),
      });
    }
  };

  const handleSignUp = () => {
    const nameErr = validateName(formState.name);
    const emailErr = validateEmail(formState.email);
    const passwordErr = validatePassword(formState.password);
    dispatchForm({
      type: "SET_ERRORS",
      errors: { name: nameErr, email: emailErr, password: passwordErr },
    });
    if (nameErr || emailErr || passwordErr) return;
    emailSignUp.mutate({
      name: formState.name.trim(),
      email: formState.email,
      password: formState.password,
    });
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (isFromOnboarding) {
      router.replace("/(onboarding)" as Href);
      return;
    }

    router.replace("/(public)/sign-in" as Href);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={handleGoBack}
              className="-ml-1 flex-row items-center gap-1 px-2 py-1"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft
                size={18}
                color={wearbloomTheme.colors["text-secondary"]}
              />
              <ThemedText variant="body" className="text-text-secondary">
                Back
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <SignUpContent
        isFromOnboarding={isFromOnboarding}
        formState={formState}
        isLoading={isLoading}
        isEmailPending={emailSignUp.isPending}
        onAppleSignUp={() => appleSignIn.mutate()}
        onNameChange={handleNameChange}
        onEmailChange={handleEmailChange}
        onPasswordChange={handlePasswordChange}
        onNameBlur={() =>
          dispatchForm({
            type: "SET_ERROR",
            field: "name",
            value: validateName(formState.name),
          })
        }
        onEmailBlur={() =>
          dispatchForm({
            type: "SET_ERROR",
            field: "email",
            value: validateEmail(formState.email),
          })
        }
        onPasswordBlur={() =>
          dispatchForm({
            type: "SET_ERROR",
            field: "password",
            value: validatePassword(formState.password),
          })
        }
        onSignUp={handleSignUp}
        onSkip={handleGoBack}
        onNavigateSignIn={() => router.replace("/(public)/sign-in" as Href)}
      />
    </>
  );
}

interface SignUpContentProps {
  isFromOnboarding: boolean;
  formState: SignUpFormState;
  isLoading: boolean;
  isEmailPending: boolean;
  onAppleSignUp: () => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onNameBlur: () => void;
  onEmailBlur: () => void;
  onPasswordBlur: () => void;
  onSignUp: () => void;
  onSkip: () => void;
  onNavigateSignIn: () => void;
}

function SignUpContent({
  isFromOnboarding,
  formState,
  isLoading,
  isEmailPending,
  onAppleSignUp,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onNameBlur,
  onEmailBlur,
  onPasswordBlur,
  onSignUp,
  onSkip,
  onNavigateSignIn,
}: SignUpContentProps) {
  return (
    <SafeScreen className="bg-background">
      <AppScrollView
        screen="public-sign-up"
        className="flex-1 px-6"
        contentContainerClassName="flex-grow justify-center py-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <ThemedText
            variant="display"
            className={`text-center ${isFromOnboarding ? "mb-2" : "mb-8"}`}
          >
            {isFromOnboarding ? "Create Free Account" : "Create Account"}
          </ThemedText>

          {isFromOnboarding && (
            <ThemedText
              variant="body"
              className="mb-8 text-center text-[15px] text-text-secondary"
              accessibilityRole="text"
            >
              Save your wardrobe and unlock more free try-ons
            </ThemedText>
          )}

          {Platform.OS === "ios" && (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={{ height: 52, width: "100%" }}
                onPress={onAppleSignUp}
              />

              <View className="my-6 flex-row items-center">
                <View className="flex-1 border-b border-border" />
                <ThemedText
                  variant="caption"
                  className="mx-4 text-text-secondary"
                >
                  or sign up with email
                </ThemedText>
                <View className="flex-1 border-b border-border" />
              </View>
            </>
          )}

          <SignUpField
            containerClassName="mb-4"
            placeholder="Name"
            value={formState.name}
            onChangeText={onNameChange}
            onBlur={onNameBlur}
            autoCapitalize="words"
            autoComplete="name"
            accessibilityLabel="Full name"
            errorMessage={formState.errors.name}
          />

          <SignUpField
            containerClassName="mb-4"
            placeholder="Email"
            value={formState.email}
            onChangeText={onEmailChange}
            onBlur={onEmailBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            accessibilityLabel="Email address"
            errorMessage={formState.errors.email}
          />

          <SignUpField
            containerClassName="mb-6"
            placeholder="Password"
            value={formState.password}
            onChangeText={onPasswordChange}
            onBlur={onPasswordBlur}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="Password"
            errorMessage={formState.errors.password}
          />

          <Button
            label={isFromOnboarding ? "Create Free Account" : "Create Account"}
            onPress={onSignUp}
            isLoading={isEmailPending}
            disabled={isLoading}
          />

          <View className="mt-6 items-center">
            {isFromOnboarding ? (
              <Button
                label="Skip for now"
                variant="ghost"
                onPress={onSkip}
                disabled={isLoading}
                accessibilityHint="Returns to onboarding to try more combinations"
              />
            ) : (
              <Button
                label="Already have an account? Sign in"
                variant="ghost"
                onPress={onNavigateSignIn}
                disabled={isLoading}
              />
            )}
          </View>
        </View>
      </AppScrollView>
    </SafeScreen>
  );
}

interface SignUpFieldProps {
  containerClassName: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  accessibilityLabel: string;
  errorMessage: string;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "words";
  autoComplete?: "name" | "email" | "new-password";
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
}

function SignUpField({
  containerClassName,
  placeholder,
  value,
  onChangeText,
  onBlur,
  accessibilityLabel,
  errorMessage,
  keyboardType,
  autoCapitalize,
  autoComplete,
  autoCorrect,
  secureTextEntry,
}: SignUpFieldProps) {
  return (
    <View className={containerClassName}>
      <TextInput
        className="h-[52px] rounded-xl border border-border bg-surface px-4 text-[15px] text-text-primary"
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER_COLOR}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={accessibilityLabel}
      />
      {errorMessage ? (
        <ThemedText variant="small" className="mt-1 text-error">
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}
