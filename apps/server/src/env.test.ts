import { describe, expect, test } from "bun:test";
import { z } from "zod/v4";

// Replicate the schema from env.ts to test validation logic
const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
});

describe("env validation", () => {
  test("parses valid DATABASE_URL and PORT", () => {
    const result = envSchema.parse({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
      PORT: "4000",
    });
    expect(result.DATABASE_URL).toBe(
      "postgresql://postgres:postgres@localhost:5432/wearbloom",
    );
    expect(result.PORT).toBe(4000);
  });

  test("defaults PORT to 3000 when not provided", () => {
    const result = envSchema.parse({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wearbloom",
    });
    expect(result.PORT).toBe(3000);
  });

  test("throws on missing DATABASE_URL", () => {
    expect(() => envSchema.parse({})).toThrow();
  });

  test("throws on invalid DATABASE_URL", () => {
    expect(() => envSchema.parse({ DATABASE_URL: "not-a-url" })).toThrow();
  });
});
