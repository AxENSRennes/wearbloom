import { mock } from "bun:test";

import type { ImageStorage } from "../src/trpc";

// ---------------------------------------------------------------------------
// Shared mock factories for router tests
// ---------------------------------------------------------------------------

/**
 * Typed against the real ImageStorage interface — future interface changes
 * break here instead of silently diverging across multiple test files.
 */
export function createMockImageStorage(): ImageStorage {
  return {
    saveBodyPhoto: mock(() => Promise.resolve("user-123/body/avatar_123.jpg")),
    deleteBodyPhoto: mock(() => Promise.resolve()),
    deleteUserDirectory: mock(() => Promise.resolve()),
    getAbsolutePath: mock((p: string) => `/data/images/${p}`),
    streamFile: mock(() => new ReadableStream()),
    saveGarmentPhoto: mock(() =>
      Promise.resolve("user-123/garments/garment-abc_original.jpg"),
    ),
    saveCutoutPhoto: mock(() =>
      Promise.resolve("user-123/garments/garment-abc_cutout.png"),
    ),
    deleteGarmentFiles: mock(() => Promise.resolve()),
    saveRenderResult: mock(() =>
      Promise.resolve("user-123/renders/render-abc_result.png"),
    ),
  };
}

// ---------------------------------------------------------------------------
// Drizzle chain builder mocks
// ---------------------------------------------------------------------------

export function mockDbSelect(results: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "limit", "orderBy"];
  for (const method of methods) {
    chain[method] = mock(() => chain);
  }
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown[]) => void;
    return resolve(results);
  });
  return chain;
}

export function mockDbInsert(returnId = "garment-abc") {
  const chain: Record<string, unknown> = {};
  chain.values = mock(() => chain);
  chain.returning = mock(() => chain);
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown[]) => void;
    return resolve([{ id: returnId }]);
  });
  return chain;
}

export function mockDbUpdate() {
  const chain: Record<string, unknown> = {};
  chain.set = mock(() => chain);
  chain.where = mock(() => chain);
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown) => void;
    return resolve(undefined);
  });
  return chain;
}

export function mockDbDelete() {
  const chain: Record<string, unknown> = {};
  chain.where = mock(() => chain);
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown) => void;
    return resolve(undefined);
  });
  return chain;
}
