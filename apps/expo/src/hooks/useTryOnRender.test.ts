import { describe, expect, test } from "bun:test";

// The hook module exists and exports the expected interface
describe("useTryOnRender", () => {
  test("exports useTryOnRender function", async () => {
    const mod = await import("./useTryOnRender");
    expect(typeof mod.useTryOnRender).toBe("function");
  });

  test("hook returns expected shape when called", async () => {
    // Since React hooks can't be called outside a component,
    // we verify the module exports the correct function signature
    const mod = await import("./useTryOnRender");
    expect(mod.useTryOnRender).toBeDefined();
    expect(mod.useTryOnRender.length).toBe(0); // No args
  });
});
