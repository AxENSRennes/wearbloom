import { describe, expect, test } from "bun:test";

import { clientPersister } from "./query-persister";

describe("query-persister", () => {
  test("clientPersister is created and is an object", () => {
    expect(clientPersister).toBeDefined();
    expect(typeof clientPersister).toBe("object");
  });
});
