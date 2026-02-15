import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createCreditService } from "./creditService";

function createMockDb(overrides?: {
  insertResult?: Promise<unknown>;
  updateResult?: Promise<{ totalConsumed: number; totalGranted: number }[]>;
  selectResult?: Promise<{ totalGranted: number; totalConsumed: number }[]>;
}) {
  const returningMock = mock(
    () => overrides?.updateResult ?? Promise.resolve([]),
  );
  const whereMockUpdate = mock(() => ({ returning: returningMock }));
  const setMock = mock(() => ({ where: whereMockUpdate }));
  const updateMock = mock(() => ({ set: setMock }));

  const onConflictDoNothingMock = mock(
    () => overrides?.insertResult ?? Promise.resolve({ rowCount: 0 }),
  );
  const valuesMock = mock(() => ({ onConflictDoNothing: onConflictDoNothingMock }));
  const insertMock = mock(() => ({ values: valuesMock }));

  const whereMockSelect = mock(
    () => overrides?.selectResult ?? Promise.resolve([]),
  );
  const fromMock = mock(() => ({ where: whereMockSelect }));
  const selectMock = mock(() => ({ from: fromMock }));

  return {
    db: { insert: insertMock, update: updateMock, select: selectMock } as never,
    mocks: {
      insert: insertMock,
      values: valuesMock,
      onConflictDoNothing: onConflictDoNothingMock,
      update: updateMock,
      set: setMock,
      whereUpdate: whereMockUpdate,
      returning: returningMock,
      select: selectMock,
      from: fromMock,
      whereSelect: whereMockSelect,
    },
  };
}

describe("creditService", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("grantFreeCredits", () => {
    test("inserts credits row with given count", async () => {
      const { db, mocks } = createMockDb();
      const service = createCreditService({ db });

      await service.grantFreeCredits("user-1", 3);

      expect(mocks.insert).toHaveBeenCalledTimes(1);
      expect(mocks.values).toHaveBeenCalledWith({
        userId: "user-1",
        totalGranted: 3,
        totalConsumed: 0,
      });
      expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(1);
    });

    test("is idempotent — onConflictDoNothing prevents duplicates", async () => {
      const { db, mocks } = createMockDb();
      const service = createCreditService({ db });

      await service.grantFreeCredits("user-1", 3);
      await service.grantFreeCredits("user-1", 3);

      expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(2);
    });
  });

  describe("consumeCredit", () => {
    test("returns success with remaining count when credits available", async () => {
      const { db } = createMockDb({
        updateResult: Promise.resolve([
          { totalConsumed: 2, totalGranted: 3 },
        ]),
      });
      const service = createCreditService({ db });

      const result = await service.consumeCredit("user-1");

      expect(result).toEqual({ success: true, remaining: 1 });
    });

    test("returns failure when no credits remaining", async () => {
      const { db } = createMockDb({
        updateResult: Promise.resolve([]),
      });
      const service = createCreditService({ db });

      const result = await service.consumeCredit("user-1");

      expect(result).toEqual({ success: false, remaining: 0 });
    });

    test("returns remaining 0 when last credit consumed", async () => {
      const { db } = createMockDb({
        updateResult: Promise.resolve([
          { totalConsumed: 3, totalGranted: 3 },
        ]),
      });
      const service = createCreditService({ db });

      const result = await service.consumeCredit("user-1");

      expect(result).toEqual({ success: true, remaining: 0 });
    });
  });

  describe("refundCredit", () => {
    test("calls update to decrement totalConsumed", async () => {
      const { db, mocks } = createMockDb({
        updateResult: Promise.resolve([
          { totalConsumed: 1, totalGranted: 3 },
        ]),
      });
      const service = createCreditService({ db });

      await service.refundCredit("user-1");

      expect(mocks.update).toHaveBeenCalledTimes(1);
      expect(mocks.set).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCreditBalance", () => {
    test("returns balance when credits row exists", async () => {
      const { db } = createMockDb({
        selectResult: Promise.resolve([
          { totalGranted: 3, totalConsumed: 1 },
        ]),
      });
      const service = createCreditService({ db });

      const result = await service.getCreditBalance("user-1");

      expect(result).toEqual({
        totalGranted: 3,
        totalConsumed: 1,
        remaining: 2,
      });
    });

    test("returns all zeros when no credits row exists", async () => {
      const { db } = createMockDb({
        selectResult: Promise.resolve([]),
      });
      const service = createCreditService({ db });

      const result = await service.getCreditBalance("user-1");

      expect(result).toEqual({
        totalGranted: 0,
        totalConsumed: 0,
        remaining: 0,
      });
    });
  });

  describe("hasCreditsRemaining", () => {
    test("returns true when remaining > 0", async () => {
      const { db } = createMockDb({
        selectResult: Promise.resolve([
          { totalGranted: 3, totalConsumed: 1 },
        ]),
      });
      const service = createCreditService({ db });

      const result = await service.hasCreditsRemaining("user-1");

      expect(result).toBe(true);
    });

    test("returns false when no credits row", async () => {
      const { db } = createMockDb({
        selectResult: Promise.resolve([]),
      });
      const service = createCreditService({ db });

      const result = await service.hasCreditsRemaining("user-1");

      expect(result).toBe(false);
    });

    test("returns false when all credits consumed", async () => {
      const { db } = createMockDb({
        selectResult: Promise.resolve([
          { totalGranted: 3, totalConsumed: 3 },
        ]),
      });
      const service = createCreditService({ db });

      const result = await service.hasCreditsRemaining("user-1");

      expect(result).toBe(false);
    });
  });
});
