import { describe, expect, test } from "bun:test";
import { telemetryConsentAllows } from "../src/telemetry";

describe("telemetry consent", () => {
  test("denies collection when no preference exists", () => {
    expect(telemetryConsentAllows(undefined, "analytics")).toBe(false);
    expect(telemetryConsentAllows(undefined, "diagnostics")).toBe(false);
  });

  test("keeps analytics and diagnostics independent", () => {
    const preference = { analyticsEnabled: true, diagnosticsEnabled: false };

    expect(telemetryConsentAllows(preference, "analytics")).toBe(true);
    expect(telemetryConsentAllows(preference, "diagnostics")).toBe(false);
  });
});
