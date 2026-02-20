import { describe, expect, mock, test } from "bun:test";

void mock.module("expo/metro-config", () => ({
  getDefaultConfig: () => ({
    watchFolders: [],
    resolver: {},
  }),
}));

void mock.module("metro-cache", () => ({
  FileStore: class FileStore {
    constructor(_options: unknown) {}
  },
}));

void mock.module("nativewind/metro", () => ({
  withNativeWind: <T>(config: T) => config,
}));

describe("tooling config references", () => {
  test("loads Expo tooling config files", async () => {
    const [babelModule, metroModule, postcssModule] = await Promise.all([
      import("../../babel.config.js"),
      import("../../metro.config.js"),
      import("../../postcss.config.mjs"),
    ]);

    expect(babelModule).toBeTruthy();
    expect(metroModule).toBeTruthy();
    expect(postcssModule).toBeTruthy();
  });
});
