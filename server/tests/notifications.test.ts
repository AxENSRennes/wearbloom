import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config";
import { APNSClient } from "../src/notifications/apns";

const baseEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://wearbloom:wearbloom@localhost:5432/wearbloom",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
};

describe("render notifications", () => {
  test("skips APNs safely when owner credentials are not configured", async () => {
    const client = new APNSClient(loadConfig(baseEnvironment));

    const result = await client.send({
      token: "a".repeat(64),
      environment: "sandbox",
      renderId: crypto.randomUUID(),
      status: "succeeded",
    });

    expect(result).toBe("skipped");
  });

  test("keeps upload and image-cost controls configurable", () => {
    const config = loadConfig({ ...baseEnvironment, MAX_ASSETS_PER_OWNER: "42", IMAGE_COST_MICROS: "125000" });

    expect(config.MAX_ASSETS_PER_OWNER).toBe(42);
    expect(config.IMAGE_COST_MICROS).toBe(125000);
  });
});
