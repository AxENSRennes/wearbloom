import { afterEach, describe, expect, mock, test } from "bun:test";

import { appendLocalImage } from "./formData";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("appendLocalImage", () => {
  test("uses React Native file append for local URIs without fetch", async () => {
    const fetchSpy = mock(
      async () => new Response(new Blob(["unused"]), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const appendSpy = mock(() => {});
    const formData = { append: appendSpy } as unknown as FormData;

    await appendLocalImage(
      formData,
      "photo",
      "file:///tmp/photo.jpg",
      "photo.jpg",
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalledTimes(1);
    const call = appendSpy.mock.calls[0] as unknown[];
    expect(call[0]).toBe("photo");
    expect(call[1]).toEqual({
      uri: "file:///tmp/photo.jpg",
      name: "photo.jpg",
      type: "image/jpeg",
    });
  });

  test("falls back to image/jpeg when remote blob has empty mime type", async () => {
    globalThis.fetch = mock(
      async () => new Response(new Blob(["jpeg-bytes"]), { status: 200 }),
    ) as unknown as typeof fetch;

    const formData = new FormData();
    await appendLocalImage(
      formData,
      "photo",
      "https://example.com/photo.jpg",
      "photo.jpg",
    );

    const entry = formData.get("photo");
    expect(entry).toBeInstanceOf(Blob);
    expect((entry as Blob).type).toBe("image/jpeg");
  });

  test("keeps valid remote blob mime types", async () => {
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
      "https://example.com/photo.png",
      "photo.png",
    );

    const entry = formData.get("photo");
    expect(entry).toBeInstanceOf(Blob);
    expect((entry as Blob).type).toBe("image/png");
  });

  test("throws LOCAL_IMAGE_READ_FAILED when remote read fails", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    const formData = new FormData();
    await expect(
      appendLocalImage(
        formData,
        "photo",
        "https://example.com/missing.jpg",
        "missing.jpg",
      ),
    ).rejects.toThrow("LOCAL_IMAGE_READ_FAILED");
  });
});
