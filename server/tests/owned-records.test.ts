import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "../src/db/schema";
import { upsertOwnedGarment, upsertOwnedLook, upsertOwnedReference } from "../src/domain/owned-records";

const ownerId = "owner-a";
const recordId = "00000000-0000-4000-8000-000000000001";
const assetId = "00000000-0000-4000-8000-000000000002";

describe("owner-scoped upserts", () => {
  test("adds an ownership predicate to every conflict update", async () => {
    const statements: string[] = [];
    const database = drizzle(
      async (query) => {
        statements.push(query);
        return { rows: [] };
      },
      { schema },
    );

    expect(
      await upsertOwnedGarment(database as never, {
        id: recordId,
        ownerId,
        name: "Top",
        category: "top",
        assetId,
        now: new Date(0),
      }),
    ).toBe(false);
    expect(
      await upsertOwnedReference(database as never, {
        id: recordId,
        ownerId,
        assetId,
        isDefault: false,
      }),
    ).toBe(false);
    expect(
      await upsertOwnedLook(database as never, {
        id: recordId,
        ownerId,
        name: "Look",
        note: "",
        garments: [{ id: recordId, category: "dress" }],
        now: new Date(0),
      }),
    ).toBe(false);

    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      expect(statement).toContain("do update set");
      expect(statement).toMatch(/where .*owner_id.*=/);
    }
    expect(statements.some((statement) => statement.startsWith("delete"))).toBe(false);
  });
});
