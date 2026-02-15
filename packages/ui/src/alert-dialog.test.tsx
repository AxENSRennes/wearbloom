import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AlertDialog,
  alertDialogButtonStyle,
  alertDialogButtonTextStyle,
} from "./alert-dialog";

// ---------------------------------------------------------------------------
// alertDialogButtonStyle variants
// ---------------------------------------------------------------------------

describe("alertDialogButtonStyle", () => {
  test("destructive variant includes bg-error", () => {
    const cls = alertDialogButtonStyle({ variant: "destructive" });
    expect(cls).toContain("bg-error");
  });

  test("destructive variant includes h-[52px]", () => {
    const cls = alertDialogButtonStyle({ variant: "destructive" });
    expect(cls).toContain("h-[52px]");
  });

  test("default variant includes bg-accent", () => {
    const cls = alertDialogButtonStyle({ variant: "default" });
    expect(cls).toContain("bg-accent");
  });

  test("cancel variant includes bg-transparent and h-[44px]", () => {
    const cls = alertDialogButtonStyle({ variant: "cancel" });
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("h-[44px]");
  });

  test("isDisabled true includes opacity-40", () => {
    const cls = alertDialogButtonStyle({ variant: "destructive", isDisabled: true });
    expect(cls).toContain("opacity-40");
  });
});

// ---------------------------------------------------------------------------
// alertDialogButtonTextStyle variants
// ---------------------------------------------------------------------------

describe("alertDialogButtonTextStyle", () => {
  test("destructive variant includes text-white", () => {
    const cls = alertDialogButtonTextStyle({ variant: "destructive" });
    expect(cls).toContain("text-white");
  });

  test("default variant includes text-white", () => {
    const cls = alertDialogButtonTextStyle({ variant: "default" });
    expect(cls).toContain("text-white");
  });

  test("cancel variant includes text-text-secondary", () => {
    const cls = alertDialogButtonTextStyle({ variant: "cancel" });
    expect(cls).toContain("text-text-secondary");
  });
});

// ---------------------------------------------------------------------------
// AlertDialog rendering tests
// ---------------------------------------------------------------------------

function render(props: Partial<Parameters<typeof AlertDialog>[0]>) {
  return renderToStaticMarkup(
    createElement(AlertDialog, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      title: "Test Title",
      message: "Test Message",
      ...props,
    }),
  );
}

describe("AlertDialog rendering", () => {
  test("renders title and message when open", () => {
    const html = render({ isOpen: true });
    expect(html).toContain("Test Title");
    expect(html).toContain("Test Message");
  });

  test("does not render content when closed", () => {
    const htmlOpen = render({ isOpen: true });
    const htmlClosed = render({ isOpen: false });
    expect(htmlOpen).toContain('visible=""');
    expect(htmlClosed).not.toContain('visible=""');
  });

  test("onConfirm button has correct label", () => {
    const html = render({ confirmLabel: "Delete Account" });
    expect(html).toContain("Delete Account");
  });

  test("onClose button has correct label", () => {
    const html = render({ cancelLabel: "Cancel" });
    expect(html).toContain("Cancel");
  });

  test("loading state shows ActivityIndicator instead of text", () => {
    const html = render({ isLoading: true });
    expect(html).toContain("mock-ActivityIndicator");
  });

  test("loading state does not show confirm label text", () => {
    const html = render({ isLoading: true, confirmLabel: "Delete" });
    expect(html).not.toMatch(/>Delete</);
  });

  test("destructive variant applied to confirm button", () => {
    const html = render({ variant: "destructive" });
    expect(html).toContain("bg-error");
  });

  test("cancel button is always present", () => {
    const html = render({ cancelLabel: "Nevermind" });
    expect(html).toContain("Nevermind");
  });

  test("accessibility role alert is present", () => {
    const html = render({});
    expect(html).toContain('accessibilityRole="alert"');
  });
});
