import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SignUpScreen from "./sign-up";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("SignUpScreen", () => {
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
});
