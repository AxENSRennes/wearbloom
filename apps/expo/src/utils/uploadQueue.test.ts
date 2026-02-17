import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { QueuedUpload } from "./uploadQueue";
import { mmkvStorage } from "./mmkv";
import {
  clearQueue,
  enqueueUpload,
  getQueueLength,
  processQueue,
} from "./uploadQueue";

const mockPayload: QueuedUpload = {
  id: "test-upload-1",
  imageUri: "file:///mock/photo.jpg",
  category: "tops",
  width: 1024,
  height: 768,
  queuedAt: "2026-02-16T12:00:00.000Z",
};

const mockPayload2: QueuedUpload = {
  id: "test-upload-2",
  imageUri: "file:///mock/photo2.jpg",
  category: "dresses",
  width: 800,
  height: 600,
  queuedAt: "2026-02-16T12:01:00.000Z",
};

describe("upload-queue", () => {
  beforeEach(() => {
    clearQueue();
  });

  afterEach(() => {
    mock.restore();
  });

  test("enqueueUpload stores upload payload and getQueueLength returns correct count", () => {
    expect(getQueueLength()).toBe(0);
    enqueueUpload(mockPayload);
    expect(getQueueLength()).toBe(1);
    enqueueUpload(mockPayload2);
    expect(getQueueLength()).toBe(2);
  });

  test("processQueue sends queued uploads via provided function", async () => {
    const uploadFn = mock(() => Promise.resolve());
    enqueueUpload(mockPayload);
    enqueueUpload(mockPayload2);

    const processed = await processQueue(uploadFn);

    expect(processed).toBe(2);
    expect(uploadFn).toHaveBeenCalledTimes(2);
    expect(getQueueLength()).toBe(0);
  });

  test("processQueue removes successful items from queue", async () => {
    const uploadFn = mock(() => Promise.resolve());
    enqueueUpload(mockPayload);

    await processQueue(uploadFn);

    expect(getQueueLength()).toBe(0);
  });

  test("processQueue retains failed items for next attempt", async () => {
    const uploadFn = mock(() => Promise.reject(new Error("Network error")));
    enqueueUpload(mockPayload);
    enqueueUpload(mockPayload2);

    const processed = await processQueue(uploadFn);

    expect(processed).toBe(0);
    expect(getQueueLength()).toBe(2);
  });

  test("processQueue handles mixed success and failure", async () => {
    let callCount = 0;
    const uploadFn = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve();
      return Promise.reject(new Error("fail"));
    });

    enqueueUpload(mockPayload);
    enqueueUpload(mockPayload2);

    const processed = await processQueue(uploadFn);

    expect(processed).toBe(1);
    expect(getQueueLength()).toBe(1);
  });

  test("getQueue filters out corrupted items missing required fields", () => {
    // Write corrupted data directly to MMKV — items missing width/height
    const corrupted = [
      {
        id: "bad-1",
        imageUri: "file:///x.jpg",
        category: "tops",
        queuedAt: "2026-01-01T00:00:00Z",
      },
      mockPayload,
      { id: "bad-2" },
      "not-an-object",
    ];
    mmkvStorage.set("wearbloom:upload-queue", JSON.stringify(corrupted));

    // Only the valid item should survive validation
    expect(getQueueLength()).toBe(1);
  });

  test("getQueue returns empty array for non-array JSON", () => {
    mmkvStorage.set(
      "wearbloom:upload-queue",
      JSON.stringify({ not: "an array" }),
    );

    expect(getQueueLength()).toBe(0);
  });

  test("getQueue returns empty array for invalid JSON", () => {
    mmkvStorage.set("wearbloom:upload-queue", "not valid json {{{");

    expect(getQueueLength()).toBe(0);
  });
});
