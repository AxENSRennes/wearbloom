import { describe, expect, mock, test } from "bun:test";

import type { AuthInstance } from "../trpc";
import { createTRPCContext } from "../trpc";

const mockSession = {
  user: { id: "user-456", name: "Auth User", email: "auth@example.com" },
  session: {
    id: "sess-456",
    token: "tok-xyz",
    expiresAt: new Date("2030-01-01"),
    createdAt: new Date(),
    userId: "user-456",
  },
};

const mockAnonymousSession = {
  user: {
    id: "anon-789",
    name: null,
    email: "temp-abc@anon.wearbloom.app",
    isAnonymous: true,
  },
  session: {
    id: "sess-anon",
    token: "tok-anon",
    expiresAt: new Date("2030-01-01"),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    userId: "anon-789",
  },
};

function createMockAuth(
  session: typeof mockSession | typeof mockAnonymousSession | null,
): AuthInstance {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
      signOut: mock(() => Promise.resolve()),
    },
  };
}

describe("auth.getSession", () => {
  test("returns session when authenticated", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(mockSession);
    const ctx = await createTRPCContext({
      headers: new Headers({ cookie: "session=xyz" }),
      auth,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getSession();

    expect(result).toEqual({ user: mockSession.user });
    expect(result?.user.id).toBe("user-456");
    expect(result?.user.email).toBe("auth@example.com");
  });

  test("returns null when not authenticated", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(null);
    const ctx = await createTRPCContext({
      headers: new Headers(),
      auth,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getSession();

    expect(result).toBeNull();
  });
});

describe("auth.signOut", () => {
  test("calls auth.api.signOut when authenticated", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(mockSession);
    const headers = new Headers({ cookie: "session=xyz" });
    const ctx = await createTRPCContext({ headers, auth });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.signOut();

    expect(result).toEqual({ success: true });
    expect(auth.api.signOut).toHaveBeenCalledWith({ headers });
  });
});

describe("auth.getEphemeralStatus", () => {
  test("returns anonymous status for anonymous user", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(mockAnonymousSession);
    const ctx = await createTRPCContext({
      headers: new Headers({ cookie: "session=anon" }),
      auth,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getEphemeralStatus();

    expect(result.isAnonymous).toBe(true);
    expect(result.hasUsedFreeRender).toBe(false);
    expect(typeof result.sessionAgeMs).toBe("number");
    expect(result.sessionAgeMs).toBeGreaterThan(0);
  });

  test("returns non-anonymous status for regular user", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(mockSession);
    const ctx = await createTRPCContext({
      headers: new Headers({ cookie: "session=xyz" }),
      auth,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getEphemeralStatus();

    expect(result.isAnonymous).toBe(false);
    expect(result.hasUsedFreeRender).toBe(false);
    expect(typeof result.sessionAgeMs).toBe("number");
  });

  test("returns null-like status when unauthenticated", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(null);
    const ctx = await createTRPCContext({
      headers: new Headers(),
      auth,
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getEphemeralStatus();

    expect(result.isAnonymous).toBe(false);
    expect(result.hasUsedFreeRender).toBe(false);
    expect(result.sessionAgeMs).toBe(0);
  });
});
