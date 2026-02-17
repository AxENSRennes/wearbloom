import { createElement } from "react";
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ConsentScreen from "./consent";

function render(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("ConsentScreen", () => {
  test("exports a function component", () => {
    expect(typeof ConsentScreen).toBe("function");
  });

  test("renders brand name Wearbloom", () => {
    const html = render(createElement(ConsentScreen));
    expect(html).toContain("Wearbloom");
  });

  test("renders data usage explanation text", () => {
    const html = render(createElement(ConsentScreen));
    expect(html).toContain("We collect your photos and wardrobe data");
    expect(html).toContain("shared only with essential providers");
    expect(html).toContain("not used for advertising or marketing");
  });

  test("renders privacy policy link text", () => {
    const html = render(createElement(ConsentScreen));
    expect(html).toContain("Read our Privacy Policy");
  });

  test("renders Accept & Continue button", () => {
    const html = render(createElement(ConsentScreen));
    expect(html).toContain("Accept &amp; Continue");
  });
});
