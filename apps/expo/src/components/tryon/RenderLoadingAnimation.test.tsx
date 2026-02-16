import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reanimated from "react-native-reanimated";

import { RenderLoadingAnimation } from "./RenderLoadingAnimation";

describe("RenderLoadingAnimation", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders body photo as base layer with correct image source", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={0}
      />,
    );

    expect(html).toContain("mock-ExpoImage");
    expect(html).toContain('testID="body-photo"');
  });

  test('shows "Creating your look..." text initially', () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={0}
      />,
    );

    expect(html).toContain("Creating your look...");
  });

  test('updates progress text to "Almost there..." after 7 seconds', () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={7000}
      />,
    );

    expect(html).toContain("Almost there...");
    expect(html).not.toContain("Creating your look...");
  });

  test('updates progress text to "Taking a bit longer..." after 10 seconds', () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={10000}
      />,
    );

    expect(html).toContain("Taking a bit longer...");
    expect(html).not.toContain("Almost there...");
  });

  test("renders garment thumbnail after 3 seconds", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl="/api/images/garment-1"
        elapsedMs={3000}
      />,
    );

    expect(html).toContain('testID="garment-thumbnail"');
  });

  test("does not render garment thumbnail before 3 seconds", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl="/api/images/garment-1"
        elapsedMs={2999}
      />,
    );

    expect(html).not.toContain('testID="garment-thumbnail"');
  });

  test("renders shimmer overlay when reduceMotion is false", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={0}
      />,
    );

    // Shimmer uses Reanimated View (mock-ReanimatedView)
    expect(html).toContain("mock-ReanimatedView");
    // Should NOT contain ActivityIndicator when motion is enabled
    expect(html).not.toContain("mock-ActivityIndicator");
  });

  test("renders spinner with progress text when reduceMotion is true", () => {
    spyOn(reanimated, "useReducedMotion").mockReturnValue(true);

    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={0}
      />,
    );

    expect(html).toContain("mock-ActivityIndicator");
    expect(html).toContain("Creating your look...");
    expect(html).not.toContain("Loading...");
  });

  test("accepts garmentImageUrl prop for thumbnail", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl="/api/images/garment-42"
        elapsedMs={5000}
      />,
    );

    expect(html).toContain('testID="garment-thumbnail"');
  });

  test("passes imageHeaders to Image source for auth-gated loading", () => {
    const headers = { Cookie: "session_token=abc123" };
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl="/api/images/garment-1"
        elapsedMs={5000}
        imageHeaders={headers}
      />,
    );

    // Component renders without error when imageHeaders are provided
    expect(html).toContain("mock-ExpoImage");
    expect(html).toContain('testID="body-photo"');
    expect(html).toContain('testID="garment-thumbnail"');
  });

  test("garment thumbnail uses Animated.View for fade-in animation", () => {
    const html = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl="/api/images/garment-1"
        elapsedMs={3000}
      />,
    );

    // The garment thumbnail container should be a Reanimated View (for fade-in)
    expect(html).toContain("mock-ReanimatedView");
    expect(html).toContain('testID="garment-thumbnail"');
  });

  test("renders progress text in reduceMotion mode at different elapsed times", () => {
    spyOn(reanimated, "useReducedMotion").mockReturnValue(true);

    const html7s = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={7000}
      />,
    );
    expect(html7s).toContain("Almost there...");

    const html10s = renderToStaticMarkup(
      <RenderLoadingAnimation
        personImageUrl="/api/images/bp-1"
        garmentImageUrl={null}
        elapsedMs={10000}
      />,
    );
    expect(html10s).toContain("Taking a bit longer...");
  });
});
