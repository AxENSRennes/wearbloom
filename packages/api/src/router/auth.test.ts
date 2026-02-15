import { describe, expect, mock, test } from "bun:test";

import type { AuthInstance } from "../trpc";
import { createTRPCContext } from "../trpc";

const mockSession = {
  user: { id: "user-456", name: "Auth User", email: "auth@example.com" },
  session: {
    id: "sess-456",
    token: "tok-xyz",
    expiresAt: new Date("2030-01-01"),
    userId: "user-456",
  },
};

function createMockAuth(session: typeof mockSession | null): AuthInstance {
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

    expect(result).toEqual(mockSession);
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
