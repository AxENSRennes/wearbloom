import { describe, expect, test } from "bun:test";
import { createV1Routes } from "../src/http/routes";

describe("HTTP validation envelope", () => {
  test("returns the documented error shape for malformed route input", async () => {
    const app = createV1Routes({} as never);
    const response = await app.request("/garments/not-a-uuid", { method: "DELETE" });
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
    expect(body.error.message.length).toBeGreaterThan(0);
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("X-Request-ID")).toBe(body.error.requestId);
  });
});
