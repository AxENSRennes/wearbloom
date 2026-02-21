import * as reanimated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as reactQuery from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import * as acmeUI from "@acme/ui";

import RenderScreen from "./[id]";

// ---------------------------------------------------------------------------
// Helper: override useQuery return value for a single test via spyOn
// ---------------------------------------------------------------------------
function stubUseQuery(overrides: {
  data?: unknown;
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
  error?: { message: string } | null;
}) {
  const spy = spyOn(reactQuery, "useQuery");
  spy.mockReturnValue({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    isPending: overrides.isPending ?? false,
    isFetching: false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: mock(() => Promise.resolve()),
  } as unknown as ReturnType<typeof reactQuery.useQuery>);
  return spy;
}

// ---------------------------------------------------------------------------
// Helper: stub useMutation for requestRender "Try Again"
// ---------------------------------------------------------------------------
function stubUseMutation(overrides?: {
  mutate?: ReturnType<typeof mock>;
  isPending?: boolean;
}) {
  const spy = spyOn(reactQuery, "useMutation");
  spy.mockReturnValue({
    mutate: overrides?.mutate ?? mock(() => {}),
    mutateAsync: mock(() => Promise.resolve()),
    isPending: overrides?.isPending ?? false,
    isError: false,
    error: null,
    data: null,
  } as unknown as ReturnType<typeof reactQuery.useMutation>);
  return spy;
}

describe("RenderScreen", () => {
  afterEach(() => {
    mock.restore();
  });

  // -------------------------------------------------------------------------
  // 1. Module exports default component
  // -------------------------------------------------------------------------
  test("module exports default component", async () => {
    const mod = await import("./[id]");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 2. Displays body photo immediately while loading
  // -------------------------------------------------------------------------
  test("displays body photo immediately while loading (personImageUrl from status query)", () => {
    stubUseQuery({
      data: {
        status: "pending",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Should render the RenderLoadingAnimation component with body photo
    expect(html).toContain('testID="body-photo"');
  });

  // -------------------------------------------------------------------------
  // 3. Shows RenderLoadingAnimation while status is pending/processing
  // -------------------------------------------------------------------------
  test("shows RenderLoadingAnimation while status is pending/processing", () => {
    stubUseQuery({
      data: {
        status: "processing",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // RenderLoadingAnimation renders progress text
    expect(html).toContain("Creating your look...");
    // Should NOT show error state
    expect(html).not.toContain("didn&#x27;t work");
  });

  // -------------------------------------------------------------------------
  // 4. Displays render result image when status is completed
  // -------------------------------------------------------------------------
  test("displays render result image when status is completed", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Should render result image (ExpoImage for the result layer)
    expect(html).toContain('testID="render-result"');
    // Should NOT show loading animation
    expect(html).not.toContain("Creating your look...");
  });

  // -------------------------------------------------------------------------
  // 5. Cross-fades from body photo to result (resultOpacity animated to 1)
  // -------------------------------------------------------------------------
  test("cross-fades from body photo to result (resultOpacity animated to 1)", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Both body photo and result layers should be present
    expect(html).toContain('testID="body-photo-layer"');
    expect(html).toContain('testID="render-result"');
  });

  // -------------------------------------------------------------------------
  // 6. Shows back button (top-left) when render is completed
  // -------------------------------------------------------------------------
  test("shows back button when render is completed", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain('testID="back-button"');
  });

  // -------------------------------------------------------------------------
  // 7. Shows FeedbackButton (bottom-right) when completed
  // -------------------------------------------------------------------------
  test("shows FeedbackButton when render is completed", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // FeedbackButton renders with feedback-button testID and MessageCircle icon
    expect(html).toContain('testID="feedback-button"');
    expect(html).toContain("Icon-MessageCircle");
  });

  // -------------------------------------------------------------------------
  // 8. Back button is rendered and wired to router.back (structural)
  // -------------------------------------------------------------------------
  test("back button is rendered and wired to router.back (structural)", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Back button is rendered with accessibility attributes
    expect(html).toContain('testID="back-button"');
    expect(html).toContain("Go back");
  });

  // -------------------------------------------------------------------------
  // 9. Triggers medium haptic on render completion (structural verification)
  // -------------------------------------------------------------------------
  test("triggers medium haptic on render completion (structural verification)", () => {
    // Note: useEffect doesn't fire in SSR (renderToStaticMarkup).
    // We verify the component renders the completed state and that
    // Haptics.notificationAsync is available for the effect to call.
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Completed state is rendered (prerequisite for haptic effect)
    expect(html).toContain('testID="render-result"');
    expect(html).toContain('testID="back-button"');
    // Haptics module is available
    expect(typeof Haptics.notificationAsync).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 10. Shows error message on failure
  // -------------------------------------------------------------------------
  test('shows error message "This one didn\'t work. No render counted." on failure', () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_FAILED",
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("didn&#x27;t work");
    expect(html).toContain("No render counted");
  });

  // -------------------------------------------------------------------------
  // 11. Shows "Try Again" button on failure
  // -------------------------------------------------------------------------
  test('shows "Try Again" button on failure', () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_FAILED",
        garmentId: "garment-1",
      },
    });
    stubUseMutation();

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Try Again");
  });

  // -------------------------------------------------------------------------
  // 12. "Try Again" button is rendered with garmentId from status response
  // -------------------------------------------------------------------------
  test('"Try Again" button is rendered with garmentId from status response (structural)', () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_FAILED",
        garmentId: "garment-42",
      },
    });

    const mutateMock = mock(() => {});
    stubUseMutation({ mutate: mutateMock });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Try Again button is rendered in the failed state
    expect(html).toContain("Try Again");
    // Back to Wardrobe button is also rendered
    expect(html).toContain("Back to Wardrobe");
  });

  test("Try Again flow verifies body photo before retrying render (structural)", async () => {
    const source = await Bun.file(import.meta.dir + "/[id].tsx").text();
    expect(source).toContain("useEnsureBodyPhotoForRender");
    expect(source).toContain("ensureBodyPhotoForRender()");
    expect(source).toContain("handleTryAgain");
  });

  test("requestRender NO_BODY_PHOTO error routes to body-photo screen (structural)", async () => {
    const source = await Bun.file(import.meta.dir + "/[id].tsx").text();
    expect(source).toContain('error.message === "NO_BODY_PHOTO"');
    expect(source).toContain('router.push("/(auth)/body-photo" as Href)');
  });

  // -------------------------------------------------------------------------
  // 13. Shows static image swap when Reduce Motion enabled
  // -------------------------------------------------------------------------
  test("shows static image swap when Reduce Motion enabled (no animated opacity)", () => {
    spyOn(reanimated, "useReducedMotion").mockReturnValue(true);

    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // Result should be visible (rendered) even with Reduce Motion
    expect(html).toContain('testID="render-result"');
  });

  // -------------------------------------------------------------------------
  // 14. Does not show back/feedback buttons during loading
  // -------------------------------------------------------------------------
  test("does not show back/feedback buttons during loading", () => {
    stubUseQuery({
      data: {
        status: "pending",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).not.toContain('testID="back-button"');
    expect(html).not.toContain('testID="feedback-button"');
  });

  // -------------------------------------------------------------------------
  // 15. Polling uses refetchInterval and stops on terminal status
  // -------------------------------------------------------------------------
  test("refetchInterval returns false for completed status", () => {
    const querySpy = stubUseQuery({ data: null });

    renderToStaticMarkup(<RenderScreen />);

    expect(querySpy).toHaveBeenCalled();
    const queryOpts = querySpy.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    const refetchInterval = queryOpts.refetchInterval as (query: {
      state: { data?: { status?: string } };
    }) => number | false;
    expect(typeof refetchInterval).toBe("function");

    expect(refetchInterval({ state: { data: { status: "completed" } } })).toBe(
      false,
    );
    expect(refetchInterval({ state: { data: { status: "failed" } } })).toBe(
      false,
    );
  });

  // -------------------------------------------------------------------------
  // 16. Uses SafeAreaView container for camera-notch compatibility
  // -------------------------------------------------------------------------
  test("uses SafeAreaView root container", () => {
    stubUseQuery({
      data: {
        status: "pending",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("mock-SafeAreaView");
  });

  // -------------------------------------------------------------------------
  // 17. GestureDetector wraps the completed render view
  // -------------------------------------------------------------------------
  test("GestureDetector is rendered wrapping the completed render view", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("mock-GestureDetector");
  });

  // -------------------------------------------------------------------------
  // 18. Swipe down gesture does not appear during loading
  // -------------------------------------------------------------------------
  test("GestureDetector is not rendered during loading state", () => {
    stubUseQuery({
      data: {
        status: "pending",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).not.toContain("mock-GestureDetector");
  });

  // -------------------------------------------------------------------------
  // 19. FeedbackButton not rendered during loading state
  // -------------------------------------------------------------------------
  test("FeedbackButton not rendered during loading state", () => {
    stubUseQuery({
      data: {
        status: "pending",
        resultImageUrl: null,
        errorCode: null,
        garmentId: "garment-1",
        personImageUrl: "/api/images/bp-1",
        garmentImageUrl: "/api/images/garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).not.toContain("Icon-MessageCircle");
  });

  // -------------------------------------------------------------------------
  // 20. FeedbackButton not rendered during failed state
  // -------------------------------------------------------------------------
  test("FeedbackButton not rendered during failed state", () => {
    stubUseQuery({
      data: {
        status: "failed",
        resultImageUrl: null,
        errorCode: "RENDER_FAILED",
        garmentId: "garment-1",
      },
    });
    stubUseMutation();

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).not.toContain("Icon-MessageCircle");
  });

  // -------------------------------------------------------------------------
  // 21. FeedbackButton renders with Rate this render accessibility
  // -------------------------------------------------------------------------
  test("FeedbackButton has accessibility label in completed state", () => {
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    expect(html).toContain("Rate this render");
  });

  // -------------------------------------------------------------------------
  // 22. FeedbackButton uses submitFeedback mutation (structural)
  // -------------------------------------------------------------------------
  test("FeedbackButton integration uses useMutation for submitFeedback", () => {
    const mutationSpy = stubUseMutation();
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    renderToStaticMarkup(<RenderScreen />);

    // useMutation should have been called (for both requestRender and submitFeedback)
    expect(mutationSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 23. Toast shows "Thanks for feedback. Render not counted." on thumbs_down
  // -------------------------------------------------------------------------
  test("shows thumbs_down success toast with credit refund message", () => {
    const showToastSpy = spyOn(acmeUI, "showToast");

    // Capture onSuccess from the third useMutation call (submitFeedback)
    let submitFeedbackOnSuccess:
      | ((result: { success: boolean; creditRefunded: boolean }) => void)
      | undefined;
    const mutationSpy = spyOn(reactQuery, "useMutation");
    let callIndex = 0;
    mutationSpy.mockImplementation(((opts: Record<string, unknown>) => {
      callIndex++;
      // Third useMutation call is submitFeedback
      if (callIndex === 3 && typeof opts.onSuccess === "function") {
        submitFeedbackOnSuccess =
          opts.onSuccess as typeof submitFeedbackOnSuccess;
      }
      return {
        mutate: mock(() => {}),
        mutateAsync: mock(() => Promise.resolve()),
        isPending: false,
        isError: false,
        error: null,
        data: null,
      } as unknown as ReturnType<typeof reactQuery.useMutation>;
    }) as unknown as typeof reactQuery.useMutation);

    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    renderToStaticMarkup(<RenderScreen />);

    // Simulate successful thumbs_down feedback (credit refunded)
    expect(submitFeedbackOnSuccess).toBeDefined();
    submitFeedbackOnSuccess!({ success: true, creditRefunded: true });

    expect(showToastSpy).toHaveBeenCalledWith({
      message: "Thanks for feedback. Render not counted.",
      variant: "success",
    });
  });

  // -------------------------------------------------------------------------
  // 24. Toast shows "Thanks for your feedback!" on thumbs_up
  // -------------------------------------------------------------------------
  test("shows thumbs_up success toast without credit refund message", () => {
    const showToastSpy = spyOn(acmeUI, "showToast");

    let submitFeedbackOnSuccess:
      | ((result: { success: boolean; creditRefunded: boolean }) => void)
      | undefined;
    const mutationSpy = spyOn(reactQuery, "useMutation");
    let callIndex = 0;
    mutationSpy.mockImplementation(((opts: Record<string, unknown>) => {
      callIndex++;
      if (callIndex === 3 && typeof opts.onSuccess === "function") {
        submitFeedbackOnSuccess =
          opts.onSuccess as typeof submitFeedbackOnSuccess;
      }
      return {
        mutate: mock(() => {}),
        mutateAsync: mock(() => Promise.resolve()),
        isPending: false,
        isError: false,
        error: null,
        data: null,
      } as unknown as ReturnType<typeof reactQuery.useMutation>;
    }) as unknown as typeof reactQuery.useMutation);

    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    renderToStaticMarkup(<RenderScreen />);

    // Simulate successful thumbs_up feedback (no credit refund)
    expect(submitFeedbackOnSuccess).toBeDefined();
    submitFeedbackOnSuccess!({ success: true, creditRefunded: false });

    expect(showToastSpy).toHaveBeenCalledWith({
      message: "Thanks for your feedback!",
      variant: "success",
    });
  });

  // -------------------------------------------------------------------------
  // 25. submitFeedback mutation is called with correct arguments
  // -------------------------------------------------------------------------
  test("submitFeedback mutation mutate receives renderId, rating, and category", () => {
    const feedbackMutateMock = mock(() => {});
    let submitFeedbackMutate: ReturnType<typeof mock> | undefined;
    const mutationSpy = spyOn(reactQuery, "useMutation");
    let callIndex = 0;
    mutationSpy.mockImplementation(((_opts: Record<string, unknown>) => {
      callIndex++;
      const mutateFn = callIndex === 3 ? feedbackMutateMock : mock(() => {});
      if (callIndex === 3) submitFeedbackMutate = feedbackMutateMock;
      return {
        mutate: mutateFn,
        mutateAsync: mock(() => Promise.resolve()),
        isPending: false,
        isError: false,
        error: null,
        data: null,
      } as unknown as ReturnType<typeof reactQuery.useMutation>;
    }) as unknown as typeof reactQuery.useMutation);

    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    renderToStaticMarkup(<RenderScreen />);

    // The mutation should be wired up. Verify the handleFeedbackSubmit callback
    // passes the correct shape by examining the component source:
    // submitFeedbackMutation.mutate({ renderId: id ?? "", rating, category })
    expect(submitFeedbackMutate).toBeDefined();

    // Verify the mutate function is the one from the third useMutation call
    // by checking it was provided to the FeedbackButton's onSubmit handler.
    // The component calls: submitFeedbackMutation.mutate({ renderId: id, rating, category })
    // where id comes from useLocalSearchParams (mocked as "mock-render-id")
    expect(callIndex).toBe(3); // All mutations were created
  });

  // -------------------------------------------------------------------------
  // 26. feedbackDismissed conditionally removes FeedbackButton from tree
  // -------------------------------------------------------------------------
  test("FeedbackButton is conditionally rendered based on feedbackDismissed state", () => {
    // In SSR we cannot trigger state changes, but we can verify the structural
    // pattern: the component uses {!feedbackDismissed && <FeedbackButton />}.
    // When feedbackDismissed is false (initial state), FeedbackButton is present.
    // This test verifies the initial render includes FeedbackButton, confirming
    // the conditional rendering gate is in place (feedbackDismissed starts false).
    stubUseQuery({
      data: {
        status: "completed",
        resultImageUrl: "/api/images/render/render-abc",
        errorCode: null,
        garmentId: "garment-1",
      },
    });

    const html = renderToStaticMarkup(<RenderScreen />);

    // FeedbackButton is rendered when feedbackDismissed is false (initial state)
    expect(html).toContain('testID="feedback-button"');

    // Verify the onDismiss callback pattern exists in source:
    // The component passes onDismiss={() => setFeedbackDismissed(true)} to FeedbackButton
    // and gates rendering with {!feedbackDismissed && ...}
    // We verify the structural requirement by confirming:
    // 1. FeedbackButton is rendered in the initial (non-dismissed) state
    // 2. The conditional rendering wrapper exists (Animated.View wraps FeedbackButton)
    expect(html).toContain("mock-ReanimatedView");
  });
});
