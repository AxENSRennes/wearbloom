import * as rq from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToString } from "react-dom/server";

import * as onboardingState from "~/utils/onboardingState";
import { BodyPhotoManager } from "./BodyPhotoManager";

describe("BodyPhotoManager", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders placeholder when no body photo exists", () => {
    const html = renderToString(<BodyPhotoManager />);

    // Should show placeholder text
    expect(html).toContain("Add Your Body Photo");
    expect(html).toContain("Take Photo");
    expect(html).toContain("Import from Gallery");
  });

  test("renders accessibility labels on interactive elements", () => {
    const html = renderToString(<BodyPhotoManager />);

    expect(html).toContain("Body photo placeholder");
  });

  test("renders take photo and import buttons", () => {
    const html = renderToString(<BodyPhotoManager />);

    expect(html).toContain("Take Photo");
    expect(html).toContain("Import from Gallery");
  });

  test("renders image and Update Photo button when photo exists", () => {
    const spy = spyOn(rq, "useQuery").mockReturnValue({
      data: { imageId: "photo-123", imageUrl: "/api/images/photo-123" },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({} as never),
    } as never);

    const html = renderToString(<BodyPhotoManager />);

    expect(html).toContain("Update Photo");
    expect(html).toContain("Your body avatar photo");
    expect(html).not.toContain("Add Your Body Photo");

    spy.mockRestore();
  });

  test("renders ExpoImage component when photo exists", () => {
    const spy = spyOn(rq, "useQuery").mockReturnValue({
      data: { imageId: "img-abc", imageUrl: "/api/images/img-abc" },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({} as never),
    } as never);

    const html = renderToString(<BodyPhotoManager />);

    // The ExpoImage component should be rendered (source prop is an object,
    // so it won't appear as a string attribute — verify component presence)
    expect(html).toContain("mock-ExpoImage");
    expect(html).toContain('contentFit="cover"');
    // Should not show the placeholder icon area
    expect(html).not.toContain("Body photo placeholder");

    spy.mockRestore();
  });

  // Story 5.4 — Clear stock flag on upload success
  test("imports setOnboardingBodyPhotoSource for clearing stock flag", () => {
    expect(typeof onboardingState.setOnboardingBodyPhotoSource).toBe(
      "function",
    );
  });

  test("setOnboardingBodyPhotoSource is not called during render", () => {
    const spy = spyOn(
      onboardingState,
      "setOnboardingBodyPhotoSource",
    ).mockResolvedValue(undefined);

    const html = renderToString(<BodyPhotoManager />);
    // Component still renders correctly with the spy in place
    expect(html).toContain("Add Your Body Photo");
    // The spy should not be called during render (only during onSuccess)
    expect(spy).not.toHaveBeenCalled();
  });

  test("upload onSuccess callback calls setOnboardingBodyPhotoSource('own')", () => {
    const sourceSpy = spyOn(
      onboardingState,
      "setOnboardingBodyPhotoSource",
    ).mockResolvedValue(undefined);

    const mutationSpy = spyOn(rq, "useMutation");

    renderToString(<BodyPhotoManager />);

    // Find the upload mutation call (useMutation is called once in BodyPhotoManager)
    expect(mutationSpy).toHaveBeenCalled();
    const firstCall = mutationSpy.mock.calls[0];
    expect(firstCall).toBeDefined();
    const mutationOpts = (firstCall as unknown[])[0] as Record<string, unknown>;

    // Invoke onSuccess handler
    const onSuccess = mutationOpts.onSuccess as (() => void) | undefined;
    expect(onSuccess).toBeDefined();
    onSuccess!();

    // Verify setOnboardingBodyPhotoSource was called with "own"
    expect(sourceSpy).toHaveBeenCalledWith("own");
  });
});
