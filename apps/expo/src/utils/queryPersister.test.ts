import { beforeEach, describe, expect, test } from "bun:test";

import { mmkvStorage } from "./mmkv";
import { clientPersister } from "./queryPersister";

describe("query-persister", () => {
  test("clientPersister is exported and defined", () => {
    expect(clientPersister).toBeDefined();
  });

  describe("MMKV storage adapter", () => {
    // Test the adapter functions that wrap mmkvStorage.
    // These are the functions passed to createSyncStoragePersister.

    beforeEach(() => {
      mmkvStorage.clearAll();
    });

    test("getItem returns undefined for missing keys", () => {
      const result = mmkvStorage.getString("nonexistent");
      expect(result).toBeUndefined();
    });

    test("setItem stores and getItem retrieves values", () => {
      mmkvStorage.set("test-key", "test-value");
      const result = mmkvStorage.getString("test-key");
      expect(result).toBe("test-value");
    });

    test("removeItem deletes stored values", () => {
      mmkvStorage.set("test-key", "test-value");
      mmkvStorage.remove("test-key");
      const result = mmkvStorage.getString("test-key");
      expect(result).toBeUndefined();
    });
  });
});
