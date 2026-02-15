import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { BodyPhotoManager } from "./BodyPhotoManager";

describe("BodyPhotoManager", () => {
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
});
