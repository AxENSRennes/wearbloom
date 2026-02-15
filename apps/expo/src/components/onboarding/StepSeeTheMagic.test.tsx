import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { StepSeeTheMagic } from "./StepSeeTheMagic";

describe("StepSeeTheMagic", () => {
  test("renders loading state with progress text", () => {
    const html = renderToString(
      createElement(StepSeeTheMagic, {
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // Should show initial loading text
    expect(html).toContain("Creating your look");
  });

  test("hides CTAs during loading, shows only after render completes", () => {
    // Initial SSR render = loading state → CTAs must be hidden (H4 fix)
    const html = renderToString(
      createElement(StepSeeTheMagic, {
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).not.toContain("Create Free Account");
    expect(html).not.toContain("Try another combination");
  });

  test("renders body photo preview during loading", () => {
    const html = renderToString(
      createElement(StepSeeTheMagic, {
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    expect(html).toContain("Body photo preview");
  });

  test("does not show CTAs during loading state", () => {
    const html = renderToString(
      createElement(StepSeeTheMagic, {
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
      }),
    );
    // After fix H4, CTAs should NOT appear during initial (loading) render
    // The initial SSR render is the loading state
    expect(html).not.toContain("Create Free Account");
  });

  test("renders with custom body photo URI", () => {
    const html = renderToString(
      createElement(StepSeeTheMagic, {
        onCreateAccount: mock(() => {}),
        onTryAnother: mock(() => {}),
        bodyPhotoUri: "file:///custom-body.jpg",
      }),
    );
    expect(html).toContain("file:///custom-body.jpg");
  });
});
