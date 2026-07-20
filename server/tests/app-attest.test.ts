import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { loadConfig } from "../src/config";
import { canonicalRequest } from "../src/security/app-attest";

const baseEnvironment = {
  DATABASE_URL: "postgresql://wearbloom:wearbloom@localhost:5432/wearbloom",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
};

describe("App Attest request binding", () => {
  test("binds the assertion to challenge, method, path, and exact body", () => {
    const body = new TextEncoder().encode('{"lookId":"one"}');
    const digest = createHash("sha256").update(body).digest("base64");
    expect(canonicalRequest("challenge", "post", "/v1/renders", body)).toBe(
      `challenge\nPOST\n/v1/renders\n${digest}`,
    );
  });

  test("requires App Attest by default in production", () => {
    const config = loadConfig({ ...baseEnvironment, NODE_ENV: "production" });
    expect(config.APP_ATTEST_REQUIRED).toBe(true);
  });

  test("allows an explicit development bypass for Simulator", () => {
    const config = loadConfig({ ...baseEnvironment, NODE_ENV: "development" });
    expect(config.APP_ATTEST_REQUIRED).toBe(false);
  });
});
