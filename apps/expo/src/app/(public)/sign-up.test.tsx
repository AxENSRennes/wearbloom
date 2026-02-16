import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// @ts-expect-error -- __searchParams is a test-only export from expo-router mock
import { __searchParams } from "expo-router";

import SignUpScreen from "./sign-up";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

const searchParams = __searchParams as { current: Record<string, string> };

describe("SignUpScreen (normal context)", () => {
  beforeEach(() => {
    searchParams.current = {};
  });

  test("exports a function component", () => {
    expect(typeof SignUpScreen).toBe("function");
  });

  test("renders Create Account heading", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Create Account");
  });

  test("renders name input with accessibility label", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Full name");
  });

  test("renders email input with accessibility label", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Email address");
  });

  test("renders password input", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Password");
  });

  test("renders Apple sign-up button on iOS", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("renders sign in link", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Already have an account");
  });

  test("renders email divider text", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("or sign up with email");
  });

  test("does not render confirm password field", () => {
    const html = render(createElement(SignUpScreen));
    const passwordMatches = html.match(/secureTextEntry/g);
    expect(passwordMatches?.length ?? 0).toBeLessThanOrEqual(1);
  });

  test("does not show benefit messaging", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).not.toContain("free try-ons");
  });

  test("does not show Skip for now button", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).not.toContain("Skip for now");
  });
});

describe("SignUpScreen (onboarding context)", () => {
  beforeEach(() => {
    searchParams.current = { from: "onboarding" };
  });

  afterEach(() => {
    searchParams.current = {};
  });

  test("renders Create Free Account heading", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Create Free Account");
  });

  test("shows benefit messaging", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("free try-ons");
  });

  test("shows Skip for now button instead of sign-in link", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Skip for now");
    expect(html).not.toContain("Already have an account");
  });

  test("Skip for now button has accessibility hint", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Returns to onboarding to try more combinations");
  });

  test("benefit messaging has accessibility role", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain('accessibilityRole');
  });

  test("still renders form fields", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("Full name");
    expect(html).toContain("Email address");
    expect(html).toContain("Password");
  });

  test("still renders Apple sign-up button", () => {
    const html = render(createElement(SignUpScreen));
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("passes onboarding completion callback to Apple Sign-In hook", async () => {
    const source = await Bun.file(import.meta.dir + "/sign-up.tsx").text();
    // useAppleSignIn should receive onSuccess with markOnboardingComplete for onboarding context
    const hookCallIndex = source.indexOf("useAppleSignIn(");
    const hookSection = source.substring(hookCallIndex, hookCallIndex + 300);
    expect(hookSection).toContain("markOnboardingComplete");
    expect(hookSection).toContain("onSuccess");
  });
});
