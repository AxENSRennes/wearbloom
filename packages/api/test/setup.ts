import { mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock @acme/db/client — drizzle client requires DATABASE_URL at import time
// Provides a chainable query builder mock that tests can override via spyOn
// ---------------------------------------------------------------------------

type QueryResult = unknown[];

function createChainableMock(result: QueryResult = []) {
  const chain: Record<string, (...args: unknown[]) => unknown> = {};

  const methods = [
    "select",
    "from",
    "where",
    "limit",
    "insert",
    "values",
    "returning",
    "delete",
    "update",
    "set",
    "orderBy",
  ];

  for (const method of methods) {
    chain[method] = mock((..._args: unknown[]) => chain);
  }

  // Terminal methods that resolve the chain
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: QueryResult) => void;
    return resolve(result);
  });

  // Make it thenable so await works
  Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });

  return chain;
}

const mockDb = createChainableMock();

void mock.module("@acme/db/client", () => ({
  db: mockDb,
  __mockDb: mockDb,
}));
