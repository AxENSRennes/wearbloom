import { describe, expect, mock, spyOn, test } from "bun:test";

import type { AuthInstance } from "../trpc";
import { createTRPCContext } from "../trpc";

const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: {
    id: "sess-123",
    token: "tok-abc",
    expiresAt: new Date("2030-01-01"),
    userId: "user-123",
  },
};

function createMockAuth(
  session: typeof mockSession | null = mockSession,
): AuthInstance {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
      signOut: mock(() => Promise.resolve()),
    },
  };
}

function createMockImageStorage() {
  return {
    saveBodyPhoto: mock(() => Promise.resolve("user-123/body/avatar_123.jpg")),
    deleteBodyPhoto: mock(() => Promise.resolve()),
    getAbsolutePath: mock(
      (p: string) => `/data/images/${p}`,
    ),
    streamFile: mock(() => new ReadableStream()),
  };
}

async function createAuthenticatedCaller(
  imageStorage = createMockImageStorage(),
  session: typeof mockSession | null = mockSession,
) {
  const { appRouter } = await import("../root");
  const auth = createMockAuth(session);
  const ctx = await createTRPCContext({
    headers: new Headers({ cookie: "session=xyz" }),
    auth,
    imageStorage,
  });
  return { caller: appRouter.createCaller(ctx), imageStorage };
}

describe("user.getBodyPhoto", () => {
  test("returns null when user has no body photo", async () => {
    const { caller } = await createAuthenticatedCaller();

    const result = await caller.user.getBodyPhoto();

    expect(result).toBeNull();
  });

  test("returns imageUrl when user has a body photo", async () => {
    const { db } = await import("@acme/db/client");

    // Override the chain to return a photo record for this test
    const photoResult = [{ id: "photo-abc" }];
    const chain: Record<string, unknown> = {};
    const methods = ["select", "from", "where", "limit"];
    for (const method of methods) {
      chain[method] = mock(() => chain);
    }
    chain.then = mock((...args: unknown[]) => {
      const resolve = args[0] as (val: unknown[]) => void;
      return resolve(photoResult);
    });
    const selectSpy = spyOn(db as never, "select").mockReturnValue(
      chain as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.user.getBodyPhoto();

    expect(result).toEqual({
      imageId: "photo-abc",
      imageUrl: "/api/images/photo-abc",
    });

    selectSpy.mockRestore();
  });
});

describe("user.uploadBodyPhoto", () => {
  test("rejects unauthenticated requests", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(null);
    const ctx = await createTRPCContext({
      headers: new Headers(),
      auth,
      imageStorage: createMockImageStorage(),
    });
    const caller = appRouter.createCaller(ctx);

    const formData = new FormData();
    formData.append("photo", new File(["data"], "photo.jpg", { type: "image/jpeg" }));

    await expect(caller.user.uploadBodyPhoto(formData)).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });
});

describe("user.uploadBodyPhoto validation", () => {
  test("rejects file with invalid mime type", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "photo.gif", { type: "image/gif" }),
    );

    await expect(caller.user.uploadBodyPhoto(formData)).rejects.toThrow(
      /INVALID_IMAGE_TYPE/,
    );
  });

  test("rejects file exceeding 10MB", async () => {
    const { caller } = await createAuthenticatedCaller();

    // Create a file > 10MB
    const bigData = new Uint8Array(11 * 1024 * 1024);
    const formData = new FormData();
    formData.append(
      "photo",
      new File([bigData], "big.jpg", { type: "image/jpeg" }),
    );

    await expect(caller.user.uploadBodyPhoto(formData)).rejects.toThrow(
      /IMAGE_TOO_LARGE/,
    );
  });

  test("rejects missing photo field", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    // No photo appended

    await expect(caller.user.uploadBodyPhoto(formData)).rejects.toThrow(
      /MISSING_PHOTO/,
    );
  });
});
