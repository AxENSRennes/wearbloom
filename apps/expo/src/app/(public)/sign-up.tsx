import { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { Button, showToast, ThemedText, wearbloomTheme } from "@acme/ui";

import { useAppleSignIn } from "~/hooks/useAppleSignIn";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";
import { markOnboardingComplete } from "~/utils/onboardingState";

const PLACEHOLDER_COLOR = wearbloomTheme.colors["text-tertiary"];

export default function SignUpScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const isFromOnboarding = from === "onboarding";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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
      if (isFromOnboarding) {
        await markOnboardingComplete();
        // TODO(Story-1.5): Associate onboarding body photo with user profile after body avatar management is implemented
        // TODO(Epic-2): Stock garments should appear in wardrobe grid after wardrobe management is implemented
      }
      try {
        await grantCredits.mutateAsync();
      } catch {
        showToast({
          message: "Credits will be granted later",
          variant: "info",
        });
      }
      showToast({
        message: "Welcome! Your wardrobe is ready.",
        variant: "success",
      });
      router.replace("/(auth)/(tabs)");
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

  const appleSignIn = useAppleSignIn(
    isFromOnboarding
      ? {
          onSuccess: async () => {
            await markOnboardingComplete();
            showToast({
              message: "Welcome! Your wardrobe is ready.",
              variant: "success",
            });
            router.replace("/(auth)/(tabs)");
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
    setName(value);
    if (nameError) setNameError(validateName(value));
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(validateEmail(value));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (passwordError) setPasswordError(validatePassword(value));
  };

  const handleSignUp = () => {
    const nameErr = validateName(name);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    setNameError(nameErr);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    if (nameErr || emailErr || passwordErr) return;
    emailSignUp.mutate({ name: name.trim(), email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-6">
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
              onPress={() => appleSignIn.mutate()}
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

        <View className="mb-4">
          <TextInput
            className="h-[52px] rounded-xl border border-border bg-surface px-4 text-[15px] text-text-primary"
            placeholder="Name"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={name}
            onChangeText={handleNameChange}
            onBlur={() => setNameError(validateName(name))}
            autoCapitalize="words"
            autoComplete="name"
            accessibilityLabel="Full name"
          />
          {nameError ? (
            <ThemedText variant="small" className="mt-1 text-error">
              {nameError}
            </ThemedText>
          ) : null}
        </View>

        <View className="mb-4">
          <TextInput
            className="h-[52px] rounded-xl border border-border bg-surface px-4 text-[15px] text-text-primary"
            placeholder="Email"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={email}
            onChangeText={handleEmailChange}
            onBlur={() => setEmailError(validateEmail(email))}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            accessibilityLabel="Email address"
          />
          {emailError ? (
            <ThemedText variant="small" className="mt-1 text-error">
              {emailError}
            </ThemedText>
          ) : null}
        </View>

        <View className="mb-6">
          <TextInput
            className="h-[52px] rounded-xl border border-border bg-surface px-4 text-[15px] text-text-primary"
            placeholder="Password"
            placeholderTextColor={PLACEHOLDER_COLOR}
            value={password}
            onChangeText={handlePasswordChange}
            onBlur={() => setPasswordError(validatePassword(password))}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            accessibilityLabel="Password"
          />
          {passwordError ? (
            <ThemedText variant="small" className="mt-1 text-error">
              {passwordError}
            </ThemedText>
          ) : null}
        </View>

        <Button
          label={isFromOnboarding ? "Create Free Account" : "Create Account"}
          onPress={handleSignUp}
          isLoading={emailSignUp.isPending}
          disabled={isLoading}
        />

        <View className="mt-6 items-center">
          {isFromOnboarding ? (
            <Button
              label="Skip for now"
              variant="ghost"
              onPress={() => router.back()}
              disabled={isLoading}
            />
          ) : (
            <Button
              label="Already have an account? Sign in"
              variant="ghost"
              onPress={() => router.replace("/(public)/sign-in")}
              disabled={isLoading}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
