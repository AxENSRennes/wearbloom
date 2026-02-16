import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";

import { and, eq, lt } from "@acme/db";
import { users } from "@acme/db/schema";

import { createAnonymousCleanupService } from "./anonymousCleanup";

/**
 * Helper: builds a mock db with a chainable delete → where → returning.
 * Returns the mocks so callers can inspect captured arguments.
 */
function createMockDb(deletedRows: { id: string }[] = []) {
  const mockReturning = mock((_opts?: unknown) => Promise.resolve(deletedRows));
  const mockWhere = mock((_filter?: unknown) => ({ returning: mockReturning }));
  const mockDelete = mock((_table?: unknown) => ({ where: mockWhere }));
  const mockDb = { delete: mockDelete } as unknown as Parameters<
    typeof createAnonymousCleanupService
  >[0]["db"];

  return { mockDb, mockDelete, mockWhere, mockReturning };
}

function createMockLogger() {
  return { info: mock(), error: mock() };
}

describe("anonymousCleanup", () => {
  const FIXED_NOW = new Date("2026-01-15T12:00:00.000Z").getTime();

  beforeEach(() => {
    setSystemTime(new Date(FIXED_NOW));
  });

  afterEach(() => {
    setSystemTime();
    mock.restore();
  });

  test("calls delete on the users table", async () => {
    const { mockDb, mockDelete } = createMockDb([{ id: "anon-1" }]);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    await service.cleanupExpiredAnonymousUsers(24);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    const deleteArg = mockDelete.mock.calls.at(0)?.[0];
    expect(deleteArg).toBe(users);
  });

  test("passes correct WHERE filter with isAnonymous and date cutoff", async () => {
    const ttlHours = 24;
    const expectedCutoff = new Date(FIXED_NOW - ttlHours * 60 * 60 * 1000);

    const { mockDb, mockWhere } = createMockDb([{ id: "anon-1" }]);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    await service.cleanupExpiredAnonymousUsers(ttlHours);

    expect(mockWhere).toHaveBeenCalledTimes(1);
    const whereArg = mockWhere.mock.calls.at(0)?.[0];

    // Build the expected Drizzle expression with the same operators and values
    const expectedFilter = and(
      eq(users.isAnonymous, true),
      lt(users.createdAt, expectedCutoff),
    );

    // The Drizzle SQL expression objects should be structurally equal
    expect(whereArg).toEqual(expectedFilter);
  });

  test("cutoff date is computed correctly for various TTL values", async () => {
    const ttlHours = 48;
    const expectedCutoff = new Date(FIXED_NOW - 48 * 60 * 60 * 1000);

    const { mockDb, mockWhere } = createMockDb([]);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    await service.cleanupExpiredAnonymousUsers(ttlHours);

    const whereArg = mockWhere.mock.calls.at(0)?.[0];
    const expectedFilter = and(
      eq(users.isAnonymous, true),
      lt(users.createdAt, expectedCutoff),
    );

    expect(whereArg).toEqual(expectedFilter);
  });

  test("filter always targets isAnonymous === true, never false", async () => {
    const { mockDb, mockWhere } = createMockDb([]);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    await service.cleanupExpiredAnonymousUsers(24);

    const whereArg = mockWhere.mock.calls.at(0)?.[0];

    // Build an incorrect filter that would target non-anonymous users
    const wrongFilter = and(
      eq(users.isAnonymous, false),
      lt(users.createdAt, new Date(FIXED_NOW - 24 * 60 * 60 * 1000)),
    );

    // The actual filter must NOT equal one targeting non-anonymous users
    expect(whereArg).not.toEqual(wrongFilter);

    // Verify it matches the correct filter (isAnonymous === true)
    const correctFilter = and(
      eq(users.isAnonymous, true),
      lt(users.createdAt, new Date(FIXED_NOW - 24 * 60 * 60 * 1000)),
    );
    expect(whereArg).toEqual(correctFilter);
  });

  test("returns the count of deleted rows", async () => {
    const deletedRows = [{ id: "anon-1" }, { id: "anon-2" }, { id: "anon-3" }];
    const { mockDb } = createMockDb(deletedRows);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    const count = await service.cleanupExpiredAnonymousUsers(24);

    expect(count).toBe(3);
  });

  test("returns 0 when no expired anonymous users exist", async () => {
    const { mockDb } = createMockDb([]);
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: createMockLogger(),
    });

    const count = await service.cleanupExpiredAnonymousUsers(24);

    expect(count).toBe(0);
  });

  test("logs cleanup details with deletedCount, ttlHours, and cutoff", async () => {
    const ttlHours = 24;
    const expectedCutoff = new Date(FIXED_NOW - ttlHours * 60 * 60 * 1000);

    const { mockDb } = createMockDb([{ id: "anon-1" }]);
    const mockLogger = createMockLogger();
    const service = createAnonymousCleanupService({
      db: mockDb,
      logger: mockLogger,
    });

    await service.cleanupExpiredAnonymousUsers(ttlHours);

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [logObj, logMsg] = mockLogger.info.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];

    expect(logObj).toEqual({
      deletedCount: 1,
      ttlHours: 24,
      cutoff: expectedCutoff.toISOString(),
    });
    expect(logMsg).toBe("Anonymous user cleanup completed");
  });
});
