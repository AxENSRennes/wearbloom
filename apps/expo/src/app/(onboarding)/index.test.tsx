import { createElement } from "react";
import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import OnboardingScreen from "./index";

describe("OnboardingScreen", () => {
  test("renders the first onboarding step", () => {
    const html = renderToString(createElement(OnboardingScreen));
    expect(html).toContain("First, let");
  });

  test("handleCreateAccount does not call markOnboardingComplete before navigation", async () => {
    // After fix: markOnboardingComplete should NOT be in this file at all
    // (moved to sign-up screen's success handler)
    const source = await Bun.file(import.meta.dir + "/index.tsx").text();
    expect(source).not.toContain("markOnboardingComplete");
  });

  test("handleCreateAccount navigates to sign-up with from=onboarding query param", async () => {
    const source = await Bun.file(import.meta.dir + "/index.tsx").text();
    expect(source).toContain('"/(public)/sign-up?from=onboarding"');
  });
});
