import { describe, expect, mock, test } from "bun:test";

import { createAnonymousCleanupService } from "./anonymousCleanup";

describe("anonymousCleanup", () => {
  test("deletes anonymous users older than TTL", async () => {
    const deletedRows = [{ id: "anon-1" }, { id: "anon-2" }];
    const mockReturning = mock(() => Promise.resolve(deletedRows));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));
    const mockDb = { delete: mockDelete } as unknown;
    const mockLogger = { info: mock(), error: mock() };

    const service = createAnonymousCleanupService({
      db: mockDb as Parameters<typeof createAnonymousCleanupService>[0]["db"],
      logger: mockLogger,
    });

    const count = await service.cleanupExpiredAnonymousUsers(24);

    expect(count).toBe(2);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  test("returns 0 when no expired anonymous users exist", async () => {
    const mockReturning = mock(() => Promise.resolve([]));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));
    const mockDb = { delete: mockDelete } as unknown;
    const mockLogger = { info: mock(), error: mock() };

    const service = createAnonymousCleanupService({
      db: mockDb as Parameters<typeof createAnonymousCleanupService>[0]["db"],
      logger: mockLogger,
    });

    const count = await service.cleanupExpiredAnonymousUsers(24);

    expect(count).toBe(0);
    expect(mockLogger.info).toHaveBeenCalled();
  });

  test("logs cleanup activity", async () => {
    const mockReturning = mock(() => Promise.resolve([{ id: "anon-1" }]));
    const mockWhere = mock(() => ({ returning: mockReturning }));
    const mockDelete = mock(() => ({ where: mockWhere }));
    const mockDb = { delete: mockDelete } as unknown;
    const mockLogger = { info: mock(), error: mock() };

    const service = createAnonymousCleanupService({
      db: mockDb as Parameters<typeof createAnonymousCleanupService>[0]["db"],
      logger: mockLogger,
    });

    await service.cleanupExpiredAnonymousUsers(24);

    const infoCall = mockLogger.info.mock.calls[0] as unknown[];
    expect(infoCall).toBeDefined();
  });
});
