import { createElement } from "react";
import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import RootLayout from "./_layout";

const store = (SecureStore as unknown as { __store: Map<string, string> })
  .__store;

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

// ---------------------------------------------------------------------------
// Tests — consent gate (AC#2)
// ---------------------------------------------------------------------------
describe("RootLayout consent gate", () => {
  beforeEach(() => {
    store.clear();
  });

  test("redirects to consent when consent not accepted", () => {
    const html = render(createElement(RootLayout));
    expect(html).toContain("mock-Redirect");
  });

  test("does not redirect when consent is accepted", () => {
    store.set("privacy_consent_accepted", "true");
    const html = render(createElement(RootLayout));
    expect(html).not.toContain("mock-Redirect");
  });

  test("renders Slot for child routes regardless of consent", () => {
    const html = render(createElement(RootLayout));
    expect(html).toContain("mock-Slot");
  });

  test("renders Slot when consent is accepted", () => {
    store.set("privacy_consent_accepted", "true");
    const html = render(createElement(RootLayout));
    expect(html).toContain("mock-Slot");
  });

  test("renders StatusBar", () => {
    store.set("privacy_consent_accepted", "true");
    const html = render(createElement(RootLayout));
    expect(html).toContain("mock-StatusBar");
  });
});
