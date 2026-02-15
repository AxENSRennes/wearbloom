import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { StepYourPhoto } from "./StepYourPhoto";

describe("StepYourPhoto", () => {
  test("renders headline text", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("First, let");
    expect(html).toContain("s see you");
  });

  test("renders subtext", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("Take a photo or use an example");
  });

  test("renders stock body photo preview", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    // expo-image mock renders as mock-ExpoImage
    expect(html).toContain("mock-ExpoImage");
  });

  test("renders 'Use this photo' primary button", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("Use this photo");
  });

  test("renders camera and gallery buttons", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    expect(html).toContain("Take a photo");
    expect(html).toContain("Choose from gallery");
  });

  test("'Use this photo' button has correct accessibility", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    // Verify the stock photo has accessibility label
    expect(html).toContain("Body photo preview");
  });

  test("renders three distinct action buttons", () => {
    const html = renderToString(
      createElement(StepYourPhoto, {
        onPhotoSelected: mock(() => {}),
      }),
    );
    // All three button labels must appear: primary, secondary, ghost
    const buttonMatches = html.match(/<mock-Button/g) ?? [];
    expect(buttonMatches.length).toBe(3);
  });
});
