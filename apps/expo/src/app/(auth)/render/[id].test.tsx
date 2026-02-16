import { describe, expect, test } from "bun:test";

describe("RenderScreen", () => {
  test("module exports default component", async () => {
    const mod = await import("./[id]");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
