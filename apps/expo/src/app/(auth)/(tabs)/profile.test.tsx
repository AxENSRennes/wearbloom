import { createElement } from "react";
import * as rq from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProfileScreen from "./profile";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("ProfileScreen", () => {
  afterEach(() => {
    mock.restore();
  });

  test("exports a function component", () => {
    expect(typeof ProfileScreen).toBe("function");
  });

  test("renders Profile heading", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Profile");
  });

  test("renders account subtitle", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Account settings");
  });

  test("renders Sign Out button with secondary variant", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Sign Out");
    expect(html).toContain("secondary");
  });

  test("renders Privacy Policy link", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Privacy Policy");
  });

  test("renders Legal section header", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Legal");
  });

  test("Privacy Policy has accessibility attributes", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain('accessibilityRole="link"');
    expect(html).toContain('accessibilityLabel="Privacy Policy"');
  });

  test("does not render user info when session is null", () => {
    // Default mock: useSession returns { data: null }
    const html = render(createElement(ProfileScreen));
    // The user info card only renders when session?.user exists
    // With null session, no name/email should appear
    expect(html).not.toContain("auth@example.com");
  });

  test("uses SafeAreaView as root container", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toMatch(/^<mock-SafeAreaView/);
  });

  // Body Avatar Section tests (Story 1.5)
  test("renders body photo placeholder when no photo exists", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Body photo placeholder");
  });

  test("renders Add Body Photo button when no photo", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Add Body Photo");
  });

  test("body photo row has accessibility attributes", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain('accessibilityRole="button"');
    expect(html).toContain("Navigate to body photo management screen");
  });

  // Delete Account Section tests (Story 1.6)
  test("renders Danger Zone section", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Danger Zone");
  });

  test("renders Delete Account button", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Delete Account");
  });

  test("renders AlertDialog component", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Delete Account?");
  });

  test("renders deletion warning message in AlertDialog", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("permanently delete your account");
  });

  test("AlertDialog confirm button has correct label", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain('confirmLabel="Delete Account"');
  });

  test("AlertDialog has destructive variant", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain('variant="destructive"');
  });

  test("renders Update Body Photo when photo exists", () => {
    const spy = spyOn(rq, "useQuery").mockReturnValue({
      data: { imageId: "photo-xyz", imageUrl: "/api/images/photo-xyz" },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({} as never),
    } as never);

    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Update Body Photo");
    expect(html).toContain("Your body avatar");
    expect(html).not.toContain("Body photo placeholder");

    spy.mockRestore();
  });
});
