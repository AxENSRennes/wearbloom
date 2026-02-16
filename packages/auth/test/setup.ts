import { mock } from "bun:test";

// Mock @acme/db/client — drizzle client requires DATABASE_URL at import time
void mock.module("@acme/db/client", () => ({
  db: {},
}));

// Mock better-auth and its sub-modules — third-party with side effects
const mockBetterAuth = mock(
  (config: Record<string, unknown>) =>
    ({
      api: {
        getSession: mock(() => Promise.resolve(null)),
        signOut: mock(() => Promise.resolve()),
      },
      handler: mock(),
      $Infer: {} as { Session: unknown },
      _config: config,
    }) as unknown,
);

void mock.module("better-auth", () => ({
  betterAuth: mockBetterAuth,
}));

void mock.module("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: mock(
    (_db: unknown, _opts: unknown) => (_options: unknown) => ({}),
  ),
}));

void mock.module("better-auth/plugins", () => ({
  oAuthProxy: mock((_opts: unknown) => ({ id: "oAuthProxy" })),
}));

void mock.module("@better-auth/expo", () => ({
  expo: mock(() => ({ id: "expo" })),
}));

export { mockBetterAuth };
