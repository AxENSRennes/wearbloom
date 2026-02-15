import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createImageStorage } from "./imageStorage";

describe("createImageStorage", () => {
  let basePath: string;
  let storage: ReturnType<typeof createImageStorage>;

  beforeEach(async () => {
    basePath = join(tmpdir(), `imageStorage-test-${Date.now()}`);
    await mkdir(basePath, { recursive: true });
    storage = createImageStorage({ basePath });
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  describe("saveBodyPhoto", () => {
    test("creates directory structure and writes file", async () => {
      const fileData = Buffer.from("fake-image-data");
      const filePath = await storage.saveBodyPhoto(
        "user-123",
        fileData,
        "image/jpeg",
      );

      expect(filePath).toContain("user-123/body/avatar_");
      expect(filePath).toEndWith(".jpg");

      const absolutePath = storage.getAbsolutePath(filePath);
      const written = await readFile(absolutePath);
      expect(written).toEqual(fileData);
    });

    test("uses .png extension for image/png mime type", async () => {
      const fileData = Buffer.from("fake-png-data");
      const filePath = await storage.saveBodyPhoto(
        "user-456",
        fileData,
        "image/png",
      );

      expect(filePath).toEndWith(".png");
    });
  });

  describe("deleteBodyPhoto", () => {
    test("removes file from filesystem", async () => {
      const fileData = Buffer.from("to-delete");
      const filePath = await storage.saveBodyPhoto(
        "user-del",
        fileData,
        "image/jpeg",
      );

      const absolutePath = storage.getAbsolutePath(filePath);
      expect(existsSync(absolutePath)).toBe(true);

      await storage.deleteBodyPhoto("user-del", filePath);
      expect(existsSync(absolutePath)).toBe(false);
    });
  });

  describe("getAbsolutePath", () => {
    test("resolves relative path to absolute", () => {
      const absolute = storage.getAbsolutePath("user-1/body/avatar_123.jpg");
      expect(absolute).toBe(join(basePath, "user-1/body/avatar_123.jpg"));
    });
  });

  describe("streamFile", () => {
    test("returns a readable stream for an existing file", async () => {
      const content = "stream-test-data";
      const filePath = await storage.saveBodyPhoto(
        "user-stream",
        Buffer.from(content),
        "image/jpeg",
      );

      const stream = storage.streamFile(filePath);
      expect(stream).toBeDefined();

      // Read stream to verify content
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.value) chunks.push(result.value);
        done = result.done;
      }
      const text = Buffer.concat(chunks).toString();
      expect(text).toBe(content);
    });
  });
});
