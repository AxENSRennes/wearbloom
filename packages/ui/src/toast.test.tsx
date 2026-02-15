import { describe, expect, test } from "bun:test";

import { wearbloomTheme } from "./gluestack-config";
import { showToast, ToastProvider, VARIANT_STYLES } from "./toast";

describe("VARIANT_STYLES configuration", () => {
  test("success variant has correct borderColor and defaultDuration", () => {
    expect(VARIANT_STYLES.success.borderColor).toBe(wearbloomTheme.colors.success);
    expect(VARIANT_STYLES.success.defaultDuration).toBe(2000);
  });

  test("error variant has correct borderColor and defaultDuration", () => {
    expect(VARIANT_STYLES.error.borderColor).toBe(wearbloomTheme.colors.error);
    expect(VARIANT_STYLES.error.defaultDuration).toBe(4000);
  });

  test("info variant has correct borderColor and defaultDuration", () => {
    expect(VARIANT_STYLES.info.borderColor).toBe(wearbloomTheme.colors["text-tertiary"]);
    expect(VARIANT_STYLES.info.defaultDuration).toBe(3000);
  });
});

describe("showToast", () => {
  test("is a function", () => {
    expect(typeof showToast).toBe("function");
  });

  test("does not throw when no provider is mounted", () => {
    expect(() => {
      showToast({ message: "test", variant: "info" });
    }).not.toThrow();
  });
});

describe("ToastProvider", () => {
  test("is a function", () => {
    expect(typeof ToastProvider).toBe("function");
  });
});
