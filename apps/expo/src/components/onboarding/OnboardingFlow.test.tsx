import { createElement } from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { OnboardingFlow } from "./OnboardingFlow";

describe("OnboardingFlow", () => {
  test("renders first step by default", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).toContain("First, let");
    expect(html).not.toContain("Creating your look");
  });

  test("renders onboarding progress container", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).toContain("Onboarding progress");
  });

  test("uses state-driven step flow implementation", async () => {
    const source = await Bun.file(
      import.meta.dir + "/OnboardingFlow.tsx",
    ).text();
    expect(source).toContain("const [currentStep, setCurrentStep] = useState");
    expect(source).not.toContain("react-native-reanimated-carousel");
  });

  test("passes bodyPhotoUri to result step component", async () => {
    const source = await Bun.file(
      import.meta.dir + "/OnboardingFlow.tsx",
    ).text();
    expect(source).toContain("bodyPhotoUri={bodyPhotoUri}");
    expect(source).toContain("garmentUri={garmentUri}");
  });

  test("renders first step accessibility label", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).toContain("Onboarding step 1 of 3");
  });

  test("includes previous-step back control for steps after the first", async () => {
    const source = await Bun.file(
      import.meta.dir + "/OnboardingFlow.tsx",
    ).text();
    expect(source).toContain("Go to previous step");
    expect(source).toContain("currentStep > 0");
  });
});
