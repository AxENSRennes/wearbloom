import { mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock @acme/db/client — drizzle client requires DATABASE_URL at import time
// Provides an in-memory chainable query builder mock so that inserts persist
// within a test run and selects return previously-stored rows.
// Tests can spyOn individual methods; call __mockDb.__resetStore() to clear.
//
// IMPORTANT: Chain methods are plain functions (not mock()), because Bun's
// spyOn + mockRestore does not reliably restore mock()-wrapped originals
// across test files. Other test files use spyOn(db, "insert") etc. and the
// restored originals must remain functional.
// ---------------------------------------------------------------------------

/** In-memory store keyed by table reference (same object identity across imports) */
const store = new Map<unknown, unknown[]>();

function createChainableMock() {
  // --- per-chain operation context (reset after each await) ---
  let _op: "select" | "insert" | "update" | "delete" | null = null;
  let _table: unknown = null;
  let _values: unknown = null;
  let _hasReturning = false;

  function resetOp() {
    _op = null;
    _table = null;
    _values = null;
    _hasReturning = false;
  }

  // Build chain object with plain-function methods (not mock()) so that
  // spyOn().mockRestore() across test files works reliably.
  const chain: Record<string, (...args: unknown[]) => unknown> = {};

  function chainMethod(method: string) {
    return (...args: unknown[]) => {
      switch (method) {
        case "insert":
          _op = "insert";
          _table = args[0];
          break;
        case "values": {
          _values = args[0];
          if (_table != null && _values != null) {
            const rows = store.get(_table) ?? [];
            rows.push(_values);
            store.set(_table, rows);
          }
          break;
        }
        case "select":
          _op = "select";
          break;
        case "from":
          _table = args[0];
          break;
        case "delete":
          _op = "delete";
          _table = args[0];
          break;
        case "update":
          _op = "update";
          _table = args[0];
          break;
        case "returning":
          _hasReturning = true;
          break;
        // where, limit, orderBy, onConflict*, set — no-ops
      }
      return chain;
    };
  }

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
    "onConflictDoNothing",
    "onConflictDoUpdate",
  ];

  for (const method of methods) {
    chain[method] = chainMethod(method);
  }

  // Terminal: called by `await` to resolve the chain
  chain.then = (...args: unknown[]) => {
    const resolve = args[0] as (val: unknown) => void;

    let result: unknown;
    if (_op === "select") {
      result = store.get(_table) ?? [];
    } else if (_op === "insert" && _hasReturning) {
      const rows = store.get(_table) ?? [];
      const last = rows[rows.length - 1];
      result = last ? [last] : [];
    } else if (_op === "delete") {
      if (_table != null) store.set(_table, []);
      result = undefined;
    } else {
      result = [];
    }

    resetOp();
    return resolve(result);
  };

  // Make it thenable so `await` works
  Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });

  return chain;
}

const mockDb = createChainableMock();

// Expose store reset for test isolation
(mockDb as Record<string, unknown>).__resetStore = () => store.clear();

void mock.module("@acme/db/client", () => ({
  db: mockDb,
  __mockDb: mockDb,
}));
