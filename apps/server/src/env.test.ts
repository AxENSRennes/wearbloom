import { describe, expect, test } from "bun:test";
import { z } from "zod/v4";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  BETTER_AUTH_BASE_URL: z.url().optional(),
  BETTER_AUTH_PRODUCTION_URL: z.url().optional(),
});

const productionAuthSchema = z.object({
  BETTER_AUTH_BASE_URL: z.url(),
  BETTER_AUTH_PRODUCTION_URL: z.url(),
});

function parseEnv(input: Record<string, string | undefined>) {
  const parsed = serverSchema.parse(input);

  if (parsed.NODE_ENV === "production") {
    productionAuthSchema.parse(parsed);
  }

  return parsed;
}

describe("env validation", () => {
  test("parses valid DATABASE_URL and PORT", () => {
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
      PORT: "4000",
    });

    expect(result.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/wearbloom",
    );
    expect(result.PORT).toBe(4000);
  });

  test("defaults PORT to 3000 when not provided", () => {
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
    });

    expect(result.PORT).toBe(3000);
  });

  test("throws on missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow();
  });

  test("throws on invalid DATABASE_URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "not-a-url" })).toThrow();
  });

  test("allows missing Better Auth URLs in development", () => {
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
      NODE_ENV: "development",
    });

    expect(result.BETTER_AUTH_BASE_URL).toBeUndefined();
    expect(result.BETTER_AUTH_PRODUCTION_URL).toBeUndefined();
  });

  test("throws in production when Better Auth URLs are missing", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
        NODE_ENV: "production",
      }),
    ).toThrow();
  });

  test("parses in production when Better Auth URLs are present", () => {
    const result = parseEnv({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
      NODE_ENV: "production",
      BETTER_AUTH_BASE_URL: "https://api.wearbloom.app",
      BETTER_AUTH_PRODUCTION_URL: "https://api.wearbloom.app",
    });

    expect(result.BETTER_AUTH_BASE_URL).toBe("https://api.wearbloom.app");
    expect(result.BETTER_AUTH_PRODUCTION_URL).toBe("https://api.wearbloom.app");
  });
});
