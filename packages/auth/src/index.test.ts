import { describe, expect, mock, test } from "bun:test";

// Access the mock betterAuth from preload
const { mockBetterAuth } = (await import("../test/setup")) as {
  mockBetterAuth: ReturnType<typeof mock>;
};

describe("initAuth", () => {
  test("returns an auth instance with api methods", async () => {
    const { initAuth } = await import("./index");
    const auth = initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.wearbloom",
      isDev: true,
      logger: { info: mock(), error: mock() },
    });

    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
    expect(typeof auth.api.getSession).toBe("function");
  });

  test("passes emailAndPassword enabled to betterAuth", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.wearbloom",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    expect(mockBetterAuth).toHaveBeenCalled();
    const config = mockBetterAuth.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(config).toBeDefined();

    const emailAndPassword = config.emailAndPassword as { enabled: boolean };
    expect(emailAndPassword.enabled).toBe(true);
  });

  test("configures Apple social provider with appBundleIdentifier", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.app",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const socialProviders = config.socialProviders as {
      apple: { appBundleIdentifier: string; clientId: string };
    };
    expect(socialProviders.apple.appBundleIdentifier).toBe("com.test.app");
    expect(socialProviders.apple.clientId).toBe("com.test.app");
  });

  test("includes exp:// in trustedOrigins in dev mode", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.app",
      isDev: true,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const origins = config.trustedOrigins as string[];
    expect(origins).toContain("expo://");
    expect(origins).toContain("exp://");
  });

  test("excludes exp:// from trustedOrigins in production", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "https://api.wearbloom.com",
      secret: "production-secret-at-least-32-characters",
      appleBundleId: "com.test.app",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const origins = config.trustedOrigins as string[];
    expect(origins).toContain("expo://");
    expect(origins).not.toContain("exp://");
  });

  test("configures drizzle adapter with usePlural", async () => {
    const { drizzleAdapter } = await import("better-auth/adapters/drizzle");

    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.app",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    expect(drizzleAdapter).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provider: "pg", usePlural: true }),
    );
  });

  test("exports Auth and Session types", async () => {
    const module = await import("./index");
    expect(module.initAuth).toBeDefined();
    // Auth and Session are type exports — verified by compilation
  });

  test("includes anonymous plugin with emailDomainName config", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.wearbloom",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const plugins = config.plugins as { id: string; _opts?: unknown }[];
    const anonPlugin = plugins.find((p) => p.id === "anonymous");
    expect(anonPlugin).toBeDefined();
    expect(anonPlugin?._opts).toEqual(
      expect.objectContaining({ emailDomainName: "anon.wearbloom.app" }),
    );
  });

  test("anonymous plugin has onLinkAccount callback", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.wearbloom",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const plugins = config.plugins as { id: string; _opts?: unknown }[];
    const anonPlugin = plugins.find((p) => p.id === "anonymous");
    const opts = anonPlugin?._opts as { onLinkAccount?: unknown };
    expect(typeof opts.onLinkAccount).toBe("function");
  });

  test("configures rate limiting for anonymous sign-in endpoint", async () => {
    const { initAuth } = await import("./index");
    initAuth({
      baseUrl: "http://localhost:3000",
      productionUrl: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long",
      appleBundleId: "com.test.wearbloom",
      isDev: false,
      logger: { info: mock(), error: mock() },
    });

    const config = mockBetterAuth.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const rateLimit = config.rateLimit as {
      customRules?: Record<string, { window: number; max: number }>;
    };
    expect(rateLimit.customRules?.["/sign-in/anonymous"]).toBeDefined();
    expect(rateLimit.customRules?.["/sign-in/anonymous"]?.max).toBe(5);
  });
});
