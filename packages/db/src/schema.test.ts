import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";

import { users } from "./schema";

describe("users schema", () => {
  test("has isAnonymous column", () => {
    const columns = getTableColumns(users);
    expect(columns.isAnonymous).toBeDefined();
  });

  test("isAnonymous defaults to false", () => {
    const columns = getTableColumns(users);
    expect(columns.isAnonymous?.hasDefault).toBe(true);
  });
});
