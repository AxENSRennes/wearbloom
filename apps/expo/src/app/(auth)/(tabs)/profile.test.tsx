import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ProfileScreen from "./profile";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("ProfileScreen", () => {
  test("exports a function component", () => {
    expect(typeof ProfileScreen).toBe("function");
  });

  test("renders Privacy Policy link text", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Privacy Policy");
  });

  test("renders Legal section header", () => {
    const html = render(createElement(ProfileScreen));
    expect(html).toContain("Legal");
  });
});
