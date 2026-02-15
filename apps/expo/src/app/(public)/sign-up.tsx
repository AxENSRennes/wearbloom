import { useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";

import { Button, ThemedText, showToast, wearbloomTheme } from "@acme/ui";

import { useAppleSignIn } from "~/hooks/useAppleSignIn";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const PLACEHOLDER_COLOR = wearbloomTheme.colors["text-tertiary"];

export default function SignUpScreen() {
  const router = useRouter();
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
    mutationFn: async (data: { name: string; email: string; password: string }) => {
      const result = await authClient.signUp.email(data);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: async () => {
      try {
        await grantCredits.mutateAsync();
      } catch {
        showToast({ message: "Credits will be granted later", variant: "info" });
      }
      router.replace("/(auth)/(tabs)");
    },
    onError: (error: Error) => {
      showToast({
        message: error.message || "Sign up failed",
        variant: "error",
      });
    },
  });

  const appleSignIn = useAppleSignIn();

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
        <ThemedText variant="display" className="mb-8 text-center">
          Create Account
        </ThemedText>

        {Platform.OS === "ios" && (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={{ height: 52, width: "100%" }}
              onPress={() => appleSignIn.mutate()}
            />

            <View className="my-6 flex-row items-center">
              <View className="flex-1 border-b border-border" />
              <ThemedText variant="caption" className="mx-4 text-text-secondary">
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
          label="Create Account"
          onPress={handleSignUp}
          isLoading={emailSignUp.isPending}
          disabled={isLoading}
        />

        <View className="mt-6 items-center">
          <Button
            label="Already have an account? Sign in"
            variant="ghost"
            onPress={() => router.replace("/(public)/sign-in")}
            disabled={isLoading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
