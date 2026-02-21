import { describe, expect, test } from "bun:test";

describe("body-photo route", () => {
  test("configures an explicit back action with fallback route", async () => {
    const source = await Bun.file(import.meta.dir + "/body-photo.tsx").text();

    expect(source).toContain("router.canGoBack()");
    expect(source).toContain('router.replace("/(auth)/(tabs)/" as Href)');
    expect(source).toContain("Go back");
  });
});
