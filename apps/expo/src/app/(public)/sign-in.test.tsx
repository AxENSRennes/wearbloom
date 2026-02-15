import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SignInScreen from "./sign-in";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("SignInScreen", () => {
  test("exports a function component", () => {
    expect(typeof SignInScreen).toBe("function");
  });

  test("renders Welcome Back heading", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Welcome Back");
  });

  test("renders email input with accessibility label", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Email address");
  });

  test("renders password input with accessibility label", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Password");
  });

  test("renders Sign In button", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Sign In");
  });

  test("renders create account link", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("Create one");
  });

  test("renders Apple sign-in button on iOS", () => {
    const html = render(createElement(SignInScreen));
    // Platform.OS is mocked as "ios" in test setup
    expect(html).toContain("AppleAuthenticationButton");
  });

  test("renders email divider text", () => {
    const html = render(createElement(SignInScreen));
    expect(html).toContain("or continue with email");
  });

  test("does not render confirm password field", () => {
    const html = render(createElement(SignInScreen));
    // Count password-related inputs - should only be one
    const passwordMatches = html.match(/secureTextEntry/g);
    // Only one secure text entry (password, no confirm password)
    expect(passwordMatches?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
