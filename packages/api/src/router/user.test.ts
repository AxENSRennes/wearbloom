import { describe, expect, mock, test } from "bun:test";

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
