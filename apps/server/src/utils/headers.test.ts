import { describe, expect, test } from "bun:test";

import { nodeHeadersToHeaders } from "./headers";

describe("nodeHeadersToHeaders", () => {
  test("converts simple string headers", () => {
    const result = nodeHeadersToHeaders({
      "content-type": "application/json",
      "x-custom": "value",
    });

    expect(result.get("content-type")).toBe("application/json");
    expect(result.get("x-custom")).toBe("value");
  });

  test("skips undefined values", () => {
    const result = nodeHeadersToHeaders({
      "x-present": "yes",
      "x-absent": undefined,
    });

    expect(result.get("x-present")).toBe("yes");
    expect(result.has("x-absent")).toBe(false);
  });

  test("appends each element of array-valued headers", () => {
    const result = nodeHeadersToHeaders({
      "set-cookie": ["a=1", "b=2"],
    });

    expect(result.get("set-cookie")).toBe("a=1, b=2");
  });

  test("returns empty Headers for empty input", () => {
    const result = nodeHeadersToHeaders({});

    const entries = [...result.entries()];
    expect(entries).toHaveLength(0);
  });

  test("handles mixed string and array values", () => {
    const result = nodeHeadersToHeaders({
      authorization: "Bearer token",
      "set-cookie": ["session=abc", "theme=dark"],
      accept: "text/html",
    });

    expect(result.get("authorization")).toBe("Bearer token");
    expect(result.get("set-cookie")).toBe("session=abc, theme=dark");
    expect(result.get("accept")).toBe("text/html");
  });
});
