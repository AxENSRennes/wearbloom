import { beforeEach, describe, expect, test } from "bun:test";

import { mmkvStorage } from "./mmkv";

describe("mmkv", () => {
  beforeEach(() => {
    mmkvStorage.clearAll();
  });

  test("mmkvStorage is exported and defined", () => {
    expect(mmkvStorage).toBeDefined();
  });

  test("mmkvStorage has expected API methods", () => {
    expect(typeof mmkvStorage.getString).toBe("function");
    expect(typeof mmkvStorage.set).toBe("function");
    expect(typeof mmkvStorage.remove).toBe("function");
    expect(typeof mmkvStorage.contains).toBe("function");
    expect(typeof mmkvStorage.clearAll).toBe("function");
  });

  test("set and getString work correctly", () => {
    mmkvStorage.set("key1", "value1");
    expect(mmkvStorage.getString("key1")).toBe("value1");
  });

  test("getString returns undefined for missing keys", () => {
    expect(mmkvStorage.getString("nonexistent")).toBeUndefined();
  });

  test("remove deletes a key", () => {
    mmkvStorage.set("key1", "value1");
    mmkvStorage.remove("key1");
    expect(mmkvStorage.getString("key1")).toBeUndefined();
  });

  test("contains returns true for existing keys and false for missing", () => {
    mmkvStorage.set("key1", "value1");
    expect(mmkvStorage.contains("key1")).toBe(true);
    expect(mmkvStorage.contains("nonexistent")).toBe(false);
  });

  test("clearAll removes all stored data", () => {
    mmkvStorage.set("key1", "value1");
    mmkvStorage.set("key2", "value2");
    mmkvStorage.clearAll();
    expect(mmkvStorage.getString("key1")).toBeUndefined();
    expect(mmkvStorage.getString("key2")).toBeUndefined();
  });
});
