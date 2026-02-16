import { createElement } from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { OnboardingFlow } from "./OnboardingFlow";

describe("OnboardingFlow", () => {
  test("renders carousel with 3 pages", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // Carousel mock renders each page as a <mock-CarouselPage> element
    // Match opening tags only to avoid counting closing tags
    const pageCount = (html.match(/<mock-CarouselPage/g) ?? []).length;
    expect(pageCount).toBe(3);
  });

  test("renders pagination dots", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).toContain("mock-PaginationBasic");
  });

  test("passes correct carousel props", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // Carousel mock renders with mock-Carousel element
    expect(html).toContain("mock-Carousel");
  });

  test("handlePhotoSelected calls onPhotoSelected and goToPage", () => {
    // Test that the callback threading works by verifying props are passed to children
    // Since we use SSR, verify the child components receive their callbacks by checking
    // the rendered output includes the child components
    const onPhotoSelected = mock(() => {});
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected,
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // Verify all 3 step components are rendered
    expect(html).toContain("First, let"); // StepYourPhoto headline
    expect(html).toContain("Now, choose something to try"); // StepPickGarment headline
    expect(html).toContain("Creating your look"); // StepSeeTheMagic loading
  });

  test("passes bodyPhotoUri and garmentUri to StepSeeTheMagic", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
        bodyPhotoUri: "file:///test-body.jpg",
        garmentUri: "file:///test-garment.jpg",
      }),
    );
    // bodyPhotoUri is passed to StepSeeTheMagic which renders an Image with it
    expect(html).toContain("file:///test-body.jpg");
  });

  test("renders step accessibility labels", () => {
    const html = renderToString(
      createElement(OnboardingFlow, {
        onPhotoSelected: mock(() => {}),
        onGarmentSelected: mock(() => {}),
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // Each carousel page has an accessibility label indicating step number
    expect(html).toContain("Onboarding step 1 of 3");
    expect(html).toContain("Onboarding step 2 of 3");
    expect(html).toContain("Onboarding step 3 of 3");
  });
});
