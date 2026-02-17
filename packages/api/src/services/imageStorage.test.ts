import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
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
    test("rejects path traversal in userId", async () => {
      await expect(
        storage.saveBodyPhoto("../../etc", Buffer.from("data"), "image/jpeg"),
      ).rejects.toThrow("Path traversal detected");
    });

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

  describe("deleteUserDirectory", () => {
    test("rejects path traversal in userId", async () => {
      await expect(
        storage.deleteUserDirectory("../../etc"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("removes user directory and all contents", async () => {
      // Create some files for the user
      await storage.saveBodyPhoto("user-rm", Buffer.from("img1"), "image/jpeg");
      await storage.saveBodyPhoto("user-rm", Buffer.from("img2"), "image/png");

      const userDir = join(basePath, "user-rm");
      expect(existsSync(userDir)).toBe(true);

      await storage.deleteUserDirectory("user-rm");
      expect(existsSync(userDir)).toBe(false);
    });

    test("does not throw when directory does not exist", async () => {
      // Should complete without error for a non-existent user
      await storage.deleteUserDirectory("non-existent-user");
    });
  });

  describe("saveGarmentPhoto", () => {
    test("rejects path traversal in userId", async () => {
      await expect(
        storage.saveGarmentPhoto("../../etc", Buffer.from("data"), "image/jpeg", "garment-1"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("rejects path traversal in garmentId", async () => {
      await expect(
        storage.saveGarmentPhoto("user-123", Buffer.from("data"), "image/jpeg", "../../../../etc/passwd"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("creates file at expected garment path", async () => {
      const fileData = Buffer.from("garment-image-data");
      const filePath = await storage.saveGarmentPhoto(
        "user-123",
        fileData,
        "image/jpeg",
        "garment-abc",
      );

      expect(filePath).toBe(join("user-123", "garments", "garment-abc_original.jpg"));

      const absolutePath = storage.getAbsolutePath(filePath);
      const written = await readFile(absolutePath);
      expect(written).toEqual(fileData);
    });

    test("creates garments directory if it does not exist", async () => {
      const fileData = Buffer.from("garment-data");
      const filePath = await storage.saveGarmentPhoto(
        "user-new",
        fileData,
        "image/png",
        "garment-xyz",
      );

      expect(filePath).toEndWith("_original.png");
      expect(existsSync(storage.getAbsolutePath(filePath))).toBe(true);
    });
  });

  describe("saveCutoutPhoto", () => {
    test("creates PNG cutout at expected path", async () => {
      const fileData = Buffer.from("cutout-data");
      const filePath = await storage.saveCutoutPhoto(
        "user-123",
        fileData,
        "garment-abc",
      );

      expect(filePath).toBe(join("user-123", "garments", "garment-abc_cutout.png"));

      const absolutePath = storage.getAbsolutePath(filePath);
      const written = await readFile(absolutePath);
      expect(written).toEqual(fileData);
    });
  });

  describe("saveRenderResult", () => {
    test("rejects path traversal in userId", async () => {
      await expect(
        storage.saveRenderResult("../../etc", "render-1", Buffer.from("data"), "image/png"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("rejects path traversal in renderId", async () => {
      await expect(
        storage.saveRenderResult("user-123", "../../../../etc/passwd", Buffer.from("data"), "image/png"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("creates file at expected render path", async () => {
      const imageData = Buffer.from("render-result-data");
      const filePath = await storage.saveRenderResult(
        "user-123",
        "render-abc",
        imageData,
        "image/png",
      );

      expect(filePath).toBe(
        join("user-123", "renders", "render-abc_result.png"),
      );

      const absolutePath = storage.getAbsolutePath(filePath);
      const written = await readFile(absolutePath);
      expect(written).toEqual(imageData);
    });

    test("uses .jpg extension for image/jpeg mime type", async () => {
      const imageData = Buffer.from("jpeg-render-data");
      const filePath = await storage.saveRenderResult(
        "user-456",
        "render-xyz",
        imageData,
        "image/jpeg",
      );

      expect(filePath).toEndWith("_result.jpg");
      expect(existsSync(storage.getAbsolutePath(filePath))).toBe(true);
    });

    test("defaults to .png for unknown mime type", async () => {
      const imageData = Buffer.from("unknown-render-data");
      const filePath = await storage.saveRenderResult(
        "user-789",
        "render-def",
        imageData,
        "image/webp",
      );

      expect(filePath).toEndWith("_result.png");
    });

    test("creates renders directory if it does not exist", async () => {
      const imageData = Buffer.from("new-user-render");
      const filePath = await storage.saveRenderResult(
        "user-new",
        "render-first",
        imageData,
        "image/png",
      );

      expect(filePath).toContain("renders");
      expect(existsSync(storage.getAbsolutePath(filePath))).toBe(true);
    });
  });

  describe("deleteGarmentFiles", () => {
    test("rejects path traversal in userId", async () => {
      await expect(
        storage.deleteGarmentFiles("../../etc", "garment-1"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("rejects path traversal in garmentId", async () => {
      await expect(
        storage.deleteGarmentFiles("user-123", "../../../../etc/passwd"),
      ).rejects.toThrow("Path traversal detected");
    });

    test("removes garment original and cutout files", async () => {
      // Create both files
      await storage.saveGarmentPhoto(
        "user-del",
        Buffer.from("original"),
        "image/jpeg",
        "garment-del",
      );
      await storage.saveCutoutPhoto(
        "user-del",
        Buffer.from("cutout"),
        "garment-del",
      );

      const originalPath = storage.getAbsolutePath(
        join("user-del", "garments", "garment-del_original.jpg"),
      );
      const cutoutPath = storage.getAbsolutePath(
        join("user-del", "garments", "garment-del_cutout.png"),
      );
      expect(existsSync(originalPath)).toBe(true);
      expect(existsSync(cutoutPath)).toBe(true);

      await storage.deleteGarmentFiles("user-del", "garment-del");

      expect(existsSync(originalPath)).toBe(false);
      expect(existsSync(cutoutPath)).toBe(false);
    });

    test("handles missing files gracefully", async () => {
      // Should not throw for non-existent garment
      await storage.deleteGarmentFiles("user-ghost", "garment-missing");
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

    test("rejects path traversal with ../", () => {
      expect(() => storage.streamFile("../../etc/passwd")).toThrow(
        "Path traversal detected",
      );
    });

    test("rejects path traversal with encoded sequences", () => {
      expect(() =>
        storage.streamFile("user-123/../../etc/passwd"),
      ).toThrow("Path traversal detected");
    });
  });

  describe("getAbsolutePath", () => {
    test("resolves relative path to absolute", () => {
      const absolute = storage.getAbsolutePath("user-1/body/avatar_123.jpg");
      expect(absolute).toBe(join(basePath, "user-1/body/avatar_123.jpg"));
    });

    test("rejects path traversal", () => {
      expect(() => storage.getAbsolutePath("../../etc/passwd")).toThrow(
        "Path traversal detected",
      );
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

    test("rejects path traversal", async () => {
      await expect(
        storage.deleteBodyPhoto("user-123", "../../etc/passwd"),
      ).rejects.toThrow("Path traversal detected");
    });
  });
});
