import { describe, expect, mock, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import type { AuthInstance } from "./trpc";
import { createTRPCContext } from "./trpc";

const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: {
    id: "sess-123",
    token: "tok-abc",
    expiresAt: new Date("2030-01-01"),
    userId: "user-123",
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

describe("createTRPCContext", () => {
  test("resolves session from auth.api.getSession", async () => {
    const auth = createMockAuth(mockSession);
    const headers = new Headers({ cookie: "session=abc" });

    const ctx = await createTRPCContext({ headers, auth });

    expect(auth.api.getSession).toHaveBeenCalledWith({ headers });
    expect(ctx.session).toEqual(mockSession);
  });

  test("returns null session when unauthenticated", async () => {
    const auth = createMockAuth(null);
    const headers = new Headers();

    const ctx = await createTRPCContext({ headers, auth });

    expect(ctx.session).toBeNull();
  });

  test("includes db, auth, and headers in context", async () => {
    const auth = createMockAuth(null);
    const headers = new Headers();

    const ctx = await createTRPCContext({ headers, auth });

    expect(ctx).toHaveProperty("db");
    expect(ctx.auth).toBe(auth);
    expect(ctx.headers).toBe(headers);
  });
});

describe("protectedProcedure", () => {
  test("rejects unauthenticated requests with UNAUTHORIZED", async () => {
    // Import the router to test the full middleware chain
    const { appRouter } = await import("./root");
    const auth = createMockAuth(null);
    const headers = new Headers();
    const ctx = await createTRPCContext({ headers, auth });

    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.signOut();
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });

  test("allows authenticated requests through", async () => {
    const { appRouter } = await import("./root");
    const auth = createMockAuth(mockSession);
    const headers = new Headers({ cookie: "session=abc" });
    const ctx = await createTRPCContext({ headers, auth });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.getSession();

    expect(result).toEqual({ user: mockSession.user });
  });
});
