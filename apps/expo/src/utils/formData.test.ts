import { afterEach, describe, expect, mock, test } from "bun:test";

import { appendLocalImage } from "./formData";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("appendLocalImage", () => {
  test("falls back to image/jpeg when local blob has empty mime type", async () => {
    globalThis.fetch = mock(
      async () => new Response(new Blob(["jpeg-bytes"]), { status: 200 }),
    ) as unknown as typeof fetch;

    const formData = new FormData();
    await appendLocalImage(
      formData,
      "photo",
      "file:///tmp/photo.jpg",
      "photo.jpg",
    );

    const entry = formData.get("photo");
    expect(entry).toBeInstanceOf(Blob);
    expect((entry as Blob).type).toBe("image/jpeg");
  });

  test("keeps valid blob mime types", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(new Blob(["png-bytes"], { type: "image/png" }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    const formData = new FormData();
    await appendLocalImage(
      formData,
      "photo",
      "file:///tmp/photo.png",
      "photo.png",
    );

    const entry = formData.get("photo");
    expect(entry).toBeInstanceOf(Blob);
    expect((entry as Blob).type).toBe("image/png");
  });

  test("throws LOCAL_IMAGE_READ_FAILED when local uri read fails", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    const formData = new FormData();
    await expect(
      appendLocalImage(
        formData,
        "photo",
        "file:///tmp/missing.jpg",
        "missing.jpg",
      ),
    ).rejects.toThrow("LOCAL_IMAGE_READ_FAILED");
  });
});
