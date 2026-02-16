# Story 2.5: Offline Browsing & Data Sync

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to browse my wardrobe even without internet,
So that I can look through my clothes anytime, anywhere.

## Acceptance Criteria

1. **Given** the user has previously loaded their wardrobe online **When** they open the app offline **Then** the wardrobe grid loads from local cache with no perceptible delay (NFR4) **And** garment thumbnails are available from expo-image cache

2. **Given** TanStack Query persist is configured **When** wardrobe data is fetched **Then** it is persisted to MMKV storage adapter automatically **And** cache survives app restarts

3. **Given** the user is offline **When** they try to add a garment **Then** the upload is queued for when connection is restored

4. **Given** the user is offline **When** they try to trigger an AI render **Then** a message is shown: "Needs internet for try-on"

5. **Given** the device reconnects to the internet **When** sync occurs **Then** queued uploads are processed **And** wardrobe data is refreshed from the server **And** a subtle "Back online" info toast appears (3s)

6. **Given** all garment photos on the server **When** accessed via API **Then** they are served only through the auth-gated /api/images/{imageId} endpoint (FR27, NFR6)

7. **Given** the wardrobe has cached data but is stale **When** TanStack Query refetches in background **Then** no loading spinner is shown (isFetching, not isLoading) **And** the UI updates seamlessly when fresh data arrives

## Tasks / Subtasks

- [x] Task 1: Install and configure react-native-mmkv (AC: #2)
  - [x] 1.1 Install `react-native-mmkv` via `pnpm add react-native-mmkv --filter @acme/expo`
  - [x] 1.2 Create `apps/expo/src/utils/mmkv.ts` — export singleton MMKV instance: `new MMKV({ id: "wearbloom-cache" })`
  - [x] 1.3 Verify MMKV works with Expo managed workflow + New Architecture (iOS build test)
  - [x] 1.4 Add MMKV mock to `apps/expo/test/setup.ts` for test compatibility

- [x] Task 2: Set up TanStack Query persist with MMKV adapter (AC: #1, #2, #7)
  - [x] 2.1 Write failing tests in `apps/expo/src/utils/api.test.ts` (TDD RED phase):
    - Test: `clientPersister` is created with MMKV storage methods
    - Test: `queryClient.defaultOptions` sets `gcTime` to 24 hours (persist requires `gcTime` >= `maxAge`)
    - Test: `dehydrateOptions` only persists successful queries
  - [x] 2.2 Install `@tanstack/query-sync-storage-persister` and `@tanstack/react-query-persist-client` via `pnpm add @tanstack/query-sync-storage-persister @tanstack/react-query-persist-client --filter @acme/expo`
  - [x] 2.3 Create MMKV-based sync persister in `apps/expo/src/utils/query-persister.ts`:
    - Use `createSyncStoragePersister` with MMKV `getString`/`set`/`delete` as storage adapter
    - Set `throttleTime: 1000` to prevent excessive writes
  - [x] 2.4 Update `apps/expo/src/utils/api.tsx` — add `gcTime: 1000 * 60 * 60 * 24` (24h) to `queryClient.defaultOptions.queries`
  - [x] 2.5 Update `apps/expo/src/app/_layout.tsx`:
    - Replace `QueryClientProvider` with `PersistQueryClientProvider` from `@tanstack/react-query-persist-client`
    - Pass `persistOptions={{ persister: clientPersister, dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" } }}`
  - [x] 2.6 Run tests — all GREEN

- [x] Task 3: Add network connectivity detection (AC: #3, #4, #5)
  - [x] 3.1 Install `@react-native-community/netinfo` via `pnpm add @react-native-community/netinfo --filter @acme/expo`
  - [x] 3.2 Write failing tests in `apps/expo/src/hooks/useNetworkStatus.test.ts` (TDD RED phase):
    - Test: returns `{ isConnected: true }` when NetInfo says connected
    - Test: returns `{ isConnected: false }` when NetInfo says disconnected
    - Test: `onReconnect` callback fires when transitioning from offline to online
  - [x] 3.3 Create `apps/expo/src/hooks/useNetworkStatus.ts`:
    - Use `useNetInfo()` from `@react-native-community/netinfo`
    - Export `{ isConnected, isInternetReachable }` booleans
    - Track previous state to detect offline→online transitions
    - Fire `onReconnect` callback on transition
  - [x] 3.4 Add NetInfo mock to `apps/expo/test/setup.ts`
  - [x] 3.5 Run tests — all GREEN

- [x] Task 4: Integrate offline awareness in WardrobeScreen (AC: #1, #7)
  - [x] 4.1 Write failing tests in `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` (TDD RED phase):
    - Test: cached data renders when `isLoading=false` and `data` exists (even if `isFetching=true`)
    - Test: no loading skeleton shown when `isFetching=true` but `data` already exists
    - Test: offline banner/indicator shown when `isConnected=false`
  - [x] 4.2 Update WardrobeScreen to use `useNetworkStatus()` hook
  - [x] 4.3 Add subtle offline indicator (small banner or badge) when `!isConnected`
  - [x] 4.4 Ensure pull-to-refresh is disabled or shows "No internet" feedback when offline
  - [x] 4.5 Run tests — all GREEN

- [x] Task 5: Implement offline upload queuing for garment addition (AC: #3, #5)
  - [x] 5.1 Write failing tests in `apps/expo/src/utils/upload-queue.test.ts` (TDD RED phase):
    - Test: `enqueueUpload` stores upload payload to MMKV
    - Test: `processQueue` sends queued uploads via tRPC mutation
    - Test: `processQueue` removes successful items from queue
    - Test: `processQueue` retains failed items for next attempt
    - Test: `getQueueLength` returns correct count
  - [x] 5.2 Create `apps/expo/src/utils/upload-queue.ts`:
    - Uses MMKV to persist queue across app restarts
    - `enqueueUpload(payload: QueuedUpload)`: adds to MMKV-persisted array
    - `processQueue(mutationFn)`: iterates queue, calls mutation for each, removes on success
    - `getQueueLength()`: returns current queue size
  - [x] 5.3 Update `apps/expo/src/app/(auth)/(tabs)/add.tsx`:
    - If `!isConnected` when upload is triggered: queue locally via `enqueueUpload` + show info toast "Saved for upload when back online"
    - If connected: proceed with normal `garment.upload` mutation (existing behavior)
  - [x] 5.4 Wire `processQueue` to `onReconnect` callback in `useNetworkStatus`
  - [x] 5.5 Run tests — all GREEN

- [x] Task 6: Block AI render when offline (AC: #4)
  - [x] 6.1 Write failing test:
    - Test: "Try On" action shows "Needs internet for try-on" toast when offline
  - [x] 6.2 Note: Garment detail bottom sheet (Story 3.1) is NOT yet implemented. The "Try On" action doesn't exist yet. This AC is a **forward-looking guard** — implement the offline check as a reusable utility `assertOnline(message?: string)` that Story 3.1 will consume. For now, document the utility and write its unit tests.
  - [x] 6.3 Create `apps/expo/src/utils/assertOnline.ts`:
    - `assertOnline(message?: string): boolean` — checks `NetInfo.fetch()`, shows toast if offline, returns `false`
    - Default message: "Needs internet for try-on"
  - [x] 6.4 Run tests — all GREEN

- [x] Task 7: Implement reconnection sync with "Back online" toast (AC: #5)
  - [x] 7.1 Write failing tests:
    - Test: reconnection triggers query invalidation for `garment.list`
    - Test: reconnection triggers `processQueue` for pending uploads
    - Test: "Back online" info toast appears on reconnect
  - [x] 7.2 Create `apps/expo/src/hooks/useReconnectSync.ts`:
    - Uses `useNetworkStatus` with `onReconnect` callback
    - On reconnect: invalidate `trpc.garment.list` queries, process upload queue, show "Back online" info toast (3s)
  - [x] 7.3 Wire `useReconnectSync` in the `(auth)/_layout.tsx` (runs once for all auth screens)
  - [x] 7.4 Run tests — all GREEN

- [x] Task 8: Typecheck, test, and validation (AC: all)
  - [x] 8.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x] 8.2 Run `turbo test` — all tests pass, 0 regressions
  - [x] 8.3 Verify: app opens offline with previously cached wardrobe data
  - [x] 8.4 Verify: cache survives full app restart (kill + reopen)
  - [x] 8.5 Verify: no loading spinner on background refetch (stale-while-revalidate)
  - [x] 8.6 Verify: offline garment upload is queued and processed on reconnect
  - [x] 8.7 Verify: "Back online" toast appears on reconnection
  - [x] 8.8 Verify: auth-gated image serving unchanged (FR27, NFR6)

## Dev Notes

### Story Context & Purpose

This story implements **FR9** (user can browse garment collection offline), **FR26** (local cache for offline browsing), and **FR27** (secure server storage — already implemented, verified here). It is the **fifth and final story in Epic 2** (Wardrobe Management) and transforms the wardrobe from online-only to offline-first.

This is a **primarily client-side story**: the backend is already complete (garment router, image serving). All work is in the Expo app — configuring TanStack Query persistence, adding MMKV as storage adapter, implementing network detection, and wiring reconnection sync.

**Scope boundaries:**
- **IN scope**: TanStack Query persist with MMKV, offline wardrobe browsing, network detection, upload queuing, reconnection sync, "Back online" toast, offline AI render guard utility
- **OUT of scope**: Offline garment deletion (already handled — deletion requires network, error toast on failure per Story 2.4), image prefetching strategy beyond expo-image default caching, conflict resolution for concurrent edits (single-user MVP)

[Source: epics.md#Story 2.5 — "Offline Browsing & Data Sync"]
[Source: prd.md#FR9 — "User can browse their garment collection offline"]
[Source: prd.md#FR26 — "User's wardrobe data and garment thumbnails are cached locally for offline browsing"]
[Source: prd.md#NFR4 — "Local wardrobe browsing works offline with no perceptible delay"]

### Architecture Decisions

**TanStack Query Persist + MMKV (Architecture-Mandated)**

The architecture document specifies: "Offline cache: TanStack Query persistQueryClient with MMKV storage adapter." This is a direct implementation of that decision.

Pattern:
```typescript
// apps/expo/src/utils/query-persister.ts
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { mmkvStorage } from "./mmkv";

export const clientPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string) => mmkvStorage.getString(key) ?? null,
    setItem: (key: string, value: string) => mmkvStorage.set(key, value),
    removeItem: (key: string) => mmkvStorage.delete(key),
  },
  throttleTime: 1000, // Prevent excessive writes
});
```

**Why `createSyncStoragePersister` (not Async)?** MMKV is synchronous (C++ native bridge, no async overhead). Using the sync persister avoids unnecessary Promise wrapping and gives instant cache hydration on app startup.

[Source: architecture.md#Data Architecture — "TanStack Query persist + MMKV"]
[Source: architecture.md#Frontend Architecture — "Offline cache: TanStack Query persistQueryClient with MMKV storage adapter"]

**PersistQueryClientProvider Replaces QueryClientProvider**

The root layout must switch from `QueryClientProvider` to `PersistQueryClientProvider`:

```typescript
// apps/expo/src/app/_layout.tsx — BEFORE:
<QueryClientProvider client={queryClient}>

// AFTER:
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { clientPersister } from "~/utils/query-persister";

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister: clientPersister,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === "success",
    },
  }}
>
```

`shouldDehydrateQuery` ensures only successful queries are persisted — failed or pending queries are NOT cached to MMKV.

**gcTime Must Be >= maxAge**

TanStack Query's `gcTime` (garbage collection time) must be at least as long as the persist `maxAge`. Default `maxAge` is 24 hours, so set `gcTime: 1000 * 60 * 60 * 24` (24h) on the QueryClient. Without this, queries would be GC'd from memory before persist can save them.

[Source: TanStack Query docs — persistQueryClient plugin requirements]

**Upload Queue Design (MMKV-Persisted)**

Queued uploads must survive app restarts. Using MMKV to store the queue:

```typescript
// apps/expo/src/utils/upload-queue.ts
interface QueuedUpload {
  id: string; // cuid2 for deduplication
  imageUri: string; // Local file URI (still on device)
  category: GarmentCategory;
  queuedAt: string; // ISO 8601
}

const QUEUE_KEY = "wearbloom:upload-queue";

export function enqueueUpload(payload: QueuedUpload): void {
  const current = getQueue();
  current.push(payload);
  mmkvStorage.set(QUEUE_KEY, JSON.stringify(current));
}

export async function processQueue(
  uploadFn: (payload: QueuedUpload) => Promise<void>,
): Promise<number> {
  const queue = getQueue();
  let processed = 0;
  const remaining: QueuedUpload[] = [];

  for (const item of queue) {
    try {
      await uploadFn(item);
      processed++;
    } catch {
      remaining.push(item); // Keep for next attempt
    }
  }

  mmkvStorage.set(QUEUE_KEY, JSON.stringify(remaining));
  return processed;
}
```

**Key design choice:** Queue stores the local file URI (the image is still on the device). The compression step happens at upload time (when back online), not at queue time. This avoids double-compressing or storing large compressed images in MMKV.

**Network Detection Pattern**

Using `@react-native-community/netinfo` — the standard React Native library for connectivity detection:

```typescript
// apps/expo/src/hooks/useNetworkStatus.ts
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const netInfo = useNetInfo(); // Hook from NetInfo
  const wasOffline = useRef(false);

  const isConnected = netInfo.isConnected ?? true; // Default to true
  const isInternetReachable = netInfo.isInternetReachable ?? true;

  useEffect(() => {
    if (wasOffline.current && isConnected) {
      onReconnect?.();
    }
    wasOffline.current = !isConnected;
  }, [isConnected]);

  return { isConnected, isInternetReachable };
}
```

[Source: architecture.md — "@react-native-community/netinfo" not explicitly listed but NetInfo is the standard RN solution]

**Stale-While-Revalidate UX**

The architecture mandates: "TanStack Query states for loading management (never useState for loading)." For offline browsing:
- `isLoading` = true ONLY on first load when NO cached data exists → show skeleton
- `isFetching` = true but `isLoading` = false → cached data is displayed, background refetch happening, NO spinner
- This is already how WardrobeScreen works (from Story 2.2) — persist just ensures `isLoading` is false on subsequent app opens because cached data is hydrated from MMKV immediately.

[Source: architecture.md#Process Patterns — Loading States table]

### Backend Implementation

**No backend changes required.** All garment API endpoints (list, upload, delete, getGarment) and image serving are already implemented and unchanged. Auth-gated image access via `/api/images/{imageId}` (FR27, NFR6) is already in place from Story 2.1.

### Frontend Implementation

**New packages to install:**

| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-mmkv` | Latest stable | Fast synchronous key-value storage (C++ native) |
| `@tanstack/query-sync-storage-persister` | ^5.90 | Creates sync persister from MMKV storage |
| `@tanstack/react-query-persist-client` | ^5.90 | `PersistQueryClientProvider` component |
| `@react-native-community/netinfo` | Latest stable | Network connectivity detection |

**CRITICAL: react-native-mmkv Android Build Issue**

There is a known build issue with `react-native-mmkv` and Expo SDK 54 on Android (GitHub: expo/expo#38991, mrousavy/react-native-mmkv#985). The CMake/NitroModules dependency causes Android build failures.

**Impact for Wearbloom:** LOW. The project is iOS-first with no Android at MVP (per PRD). iOS builds are unaffected. If Android is needed later, alternatives exist:
- Use `@react-native-async-storage/async-storage` with `createAsyncStoragePersister` (slower but no native build issues)
- Pin `react-native-mmkv` to a version with the fix (track GitHub issue)

[Source: prd.md — "iOS-first, no Android at MVP"]

**New files to create:**

```
apps/expo/src/utils/mmkv.ts                    — MMKV singleton instance
apps/expo/src/utils/mmkv.test.ts               — MMKV instance tests
apps/expo/src/utils/query-persister.ts          — TanStack Query sync persister with MMKV
apps/expo/src/utils/query-persister.test.ts     — Persister tests
apps/expo/src/utils/upload-queue.ts             — Offline upload queue (MMKV-persisted)
apps/expo/src/utils/upload-queue.test.ts        — Upload queue tests
apps/expo/src/utils/assertOnline.ts             — Reusable online guard utility
apps/expo/src/utils/assertOnline.test.ts        — assertOnline tests
apps/expo/src/hooks/useNetworkStatus.ts         — Network connectivity hook
apps/expo/src/hooks/useNetworkStatus.test.ts    — Network hook tests
apps/expo/src/hooks/useReconnectSync.ts         — Reconnection sync logic
apps/expo/src/hooks/useReconnectSync.test.ts    — Reconnect sync tests
```

**Files to modify:**

```
apps/expo/src/utils/api.tsx                     — Add gcTime to QueryClient defaults
apps/expo/src/app/_layout.tsx                   — Replace QueryClientProvider with PersistQueryClientProvider
apps/expo/src/app/(auth)/(tabs)/index.tsx        — Add offline indicator, disable pull-to-refresh offline
apps/expo/src/app/(auth)/(tabs)/add.tsx          — Queue upload when offline
apps/expo/src/app/(auth)/_layout.tsx             — Wire useReconnectSync hook
apps/expo/test/setup.ts                          — Add MMKV + NetInfo mocks
apps/expo/package.json                           — New dependencies
pnpm-lock.yaml                                   — Updated lockfile
```

### Existing Code References

| Component | Location | Relevance |
|-----------|----------|-----------|
| QueryClient setup | `apps/expo/src/utils/api.tsx:11-17` | Add `gcTime: 24h` to default options |
| Root layout | `apps/expo/src/app/_layout.tsx:43-49` | Replace `QueryClientProvider` with `PersistQueryClientProvider` |
| WardrobeScreen | `apps/expo/src/app/(auth)/(tabs)/index.tsx` | Add offline indicator, conditional pull-to-refresh |
| AddGarmentScreen | `apps/expo/src/app/(auth)/(tabs)/add.tsx` | Queue upload when offline |
| Auth layout | `apps/expo/src/app/(auth)/_layout.tsx` | Wire `useReconnectSync` |
| garmentRouter | `packages/api/src/router/garment.ts` | Unchanged — referenced for `garment.upload` mutation type |
| imageStorage service | `packages/api/src/services/imageStorage.ts` | Unchanged — serves auth-gated images |
| showToast | `packages/ui/src/toast.tsx:26-28` | Used for "Back online" info toast |
| GarmentCard | `apps/expo/src/components/garment/GarmentCard.tsx` | Unchanged — expo-image handles image caching |
| WardrobeItem types | `apps/expo/src/types/wardrobe.ts` | Referenced for queue payload typing |
| categories constants | `apps/expo/src/constants/categories.ts` | GarmentCategory type for queue |
| Test setup | `apps/expo/test/setup.ts` | Add MMKV + NetInfo mocks |
| pnpm-workspace catalog | `pnpm-workspace.yaml:6-21` | Check TanStack version alignment |

### Project Structure Notes

**New files follow established conventions:**
- Utilities in `apps/expo/src/utils/` (camelCase.ts)
- Custom hooks in `apps/expo/src/hooks/` (camelCase.ts)
- Tests co-located next to source files
- All imports from `bun:test`

**Alignment with architecture:**
- MMKV as cache storage — matches architecture.md specification
- TanStack Query persist — matches architecture.md specification
- Network detection via NetInfo — standard React Native approach
- Upload queue uses MMKV for persistence — survives app restarts
- No new backend endpoints — purely client-side offline support
- expo-image handles image caching automatically — no additional image cache code needed

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**Mock strategy for new dependencies:**

```typescript
// apps/expo/test/setup.ts additions:

// MMKV mock — in-memory Map simulating MMKV
mock.module("react-native-mmkv", () => {
  const store = new Map<string, string>();
  return {
    MMKV: mock(() => ({
      getString: mock((key: string) => store.get(key) ?? undefined),
      set: mock((key: string, value: string) => store.set(key, value)),
      delete: mock((key: string) => store.delete(key)),
      contains: mock((key: string) => store.has(key)),
      clearAll: mock(() => store.clear()),
    })),
  };
});

// NetInfo mock — default to connected
mock.module("@react-native-community/netinfo", () => ({
  useNetInfo: mock(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: "wifi",
  })),
  addEventListener: mock(() => mock(() => {})), // Returns unsubscribe
  fetch: mock(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true }),
  ),
}));
```

**Key test patterns:**
- For `useNetworkStatus`: use `spyOn` on the NetInfo mock to change `isConnected` between tests
- For upload queue: directly test MMKV read/write without network calls
- For reconnect sync: verify `invalidateQueries` and `processQueue` are called on transition
- For `assertOnline`: mock `NetInfo.fetch()` to return offline, verify toast is shown

**Test count estimate:** ~20-25 new tests. Current total: 292 tests (post Story 2.4). Expected total: ~315 tests.

### Key Pitfalls to Avoid

1. **DO NOT forget `gcTime >= maxAge` on QueryClient.** Without `gcTime: 24h`, TanStack Query garbage collects cached queries before persist can save them. Queries would be lost on next app open.

2. **DO NOT use `createAsyncStoragePersister` with MMKV.** MMKV is synchronous — use `createSyncStoragePersister` for instant hydration. Async would add unnecessary latency on app startup.

3. **DO NOT persist failed or pending queries.** Only persist `status === "success"` via `shouldDehydrateQuery`. Persisting error states would show stale errors on next app open.

4. **DO NOT show a loading skeleton when cached data exists.** Check `isLoading` (first load, no data) vs `isFetching` (background refetch, data exists). The existing WardrobeScreen already uses `isLoading` for skeleton — persist just ensures cached data is available immediately.

5. **DO NOT store compressed images in the upload queue.** Store the local file URI. Compression happens at upload time (when back online). This keeps MMKV storage small.

6. **DO NOT assume `isConnected` is always a boolean.** NetInfo returns `boolean | null` — `null` means unknown. Default to `true` when null (optimistic approach).

7. **DO NOT call `processQueue` synchronously in the reconnect handler.** Use `void processQueue(...)` or wrap in async IIFE. The reconnect callback should not block.

8. **DO NOT use `useState` for online/offline state.** Use the `useNetInfo()` hook from NetInfo which manages the subscription lifecycle automatically.

9. **DO NOT forget to mock MMKV and NetInfo in test setup.** Both are native modules that need `mock.module()` in preload. Since `mock.module()` is irreversible, put them in `test/setup.ts` (already used as preload).

10. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

11. **DO NOT use `console.log` on the server.** Use `logger.info()` / `logger.error()` from pino. (No server changes in this story, but good to remember.)

12. **DO NOT import test utilities from `"vitest"` or `"@jest/globals"`.** Always `import { ... } from "bun:test"`.

13. **DO NOT break the existing pull-to-refresh behavior.** When online, pull-to-refresh should work exactly as before. Only disable or show feedback when offline.

14. **DO NOT queue garment deletions offline.** Story 2.4 already handles this: deletion fails with an error toast. This is the correct UX — destructive operations should not be queued.

### Previous Story Intelligence

**From Story 2.4 (Remove Garment) — CRITICAL:**

- Total test count: **292 tests** across all packages (post code review)
- `deleteMutation` uses `onError` to show error toast on network failure — this is the correct pattern for offline deletion (no queuing)
- Story 2.4 Dev Notes mention: "Story 2.5 (Offline Browsing) — offline delete may need queuing (but that's a 2.5 concern)" → Decision: Do NOT queue deletions. Error toast on failure is the correct UX.
- `expo-haptics` was added in Story 2.4 — already available, already mocked in setup.ts
- Code review found: placeholder tests should be real behavioral tests, missing error handling patterns, accessibility gaps
- `alertDialog` with `isLoading={deleteMutation.isPending}` pattern — shows loading state without useState

**From Story 2.3 (Stock Garment Library) — REFERENCE:**

- `stockGarments` are client-side constants at `apps/expo/src/constants/stockGarments.ts` — always available offline (bundled assets)
- `WardrobeItem` = `PersonalGarment | StockGarment` discriminated union — only personal garments need cache persistence
- `isStockGarment()` type guard at `apps/expo/src/types/wardrobe.ts:12-14`
- Stock garment images are local assets (not fetched from server) — always offline-available

**From Story 2.2 (Wardrobe Grid) — REFERENCE:**

- `useQuery(trpc.garment.list.queryOptions(...))` at `apps/expo/src/app/(auth)/(tabs)/index.tsx` — this is the query that persist will cache
- `queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() })` — used on pull-to-refresh and reconnect
- `isLoading` gate controls skeleton display — persist ensures `isLoading` is false when cached data is hydrated
- LegendList renders garments — it will seamlessly display cached data on hydration

**From Story 2.1 (Add Garment) — REFERENCE:**

- `garment.upload` mutation at `apps/expo/src/app/(auth)/(tabs)/add.tsx` — this is what gets queued offline
- Upload flow: image picker → compress → FormData → tRPC mutation
- Image compression via `expo-image-manipulator` happens before upload
- For offline queuing: store the local file URI pre-compression, compress at upload time

### Git Intelligence

**Recent commits (5):**
1. `015bdc1` — fix: Story 2.4 code review — 6 issues resolved (2H/4M), status done
2. `52aec1d` — fix: Story 2.3 code review — 8 issues resolved (5M/3L), status done
3. `ff086b2` — feat: implement Story 2.3 — Stock Garment Library
4. `65dd633` — fix: Story 2.2 code review — 7 issues resolved (2H/5M), status done
5. `106e6b6` — feat: implement Story 2.2 — Wardrobe Grid & Category Browsing

**Patterns from recent work:**
- Conventional commit messages: `feat:` for implementation, `fix:` for code review
- Code review consistently catches: placeholder tests, missing error handling, accessibility gaps
- DI pattern for server services (`ctx.imageStorage` injected via context)
- All 13/13 packages typecheck clean
- `spyOn` pattern for mocking TanStack Query hooks in component tests
- SSR-based testing approach (`renderToStaticMarkup`) for WardrobeScreen tests
- `mock.module()` for native modules in `test/setup.ts` (preload)

**Files recently modified (relevant to this story):**
- `apps/expo/src/utils/api.tsx` — QueryClient configuration. Adding `gcTime`.
- `apps/expo/src/app/_layout.tsx` — Root layout with `QueryClientProvider`. Replacing with `PersistQueryClientProvider`.
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — WardrobeScreen. Adding offline indicator.
- `apps/expo/src/app/(auth)/(tabs)/add.tsx` — Add garment screen. Adding offline queue.
- `apps/expo/test/setup.ts` — Test setup. Adding MMKV + NetInfo mocks.

### Latest Tech Information

**react-native-mmkv (Latest stable):**
- Synchronous key-value storage for React Native — backed by C++ MMKV from Tencent
- ~30x faster than AsyncStorage for reads/writes
- Works with Expo managed workflow (requires dev client for native modules)
- Import: `import { MMKV } from "react-native-mmkv"`
- Instantiation: `new MMKV({ id: "unique-storage-id" })`
- API: `.getString(key)`, `.set(key, value)`, `.delete(key)`, `.contains(key)`, `.clearAll()`
- **Known issue with Expo SDK 54 Android builds** (CMake/NitroModules) — iOS builds unaffected
- If Android build issues arise, fallback: `@react-native-async-storage/async-storage` + `createAsyncStoragePersister`

**@tanstack/query-sync-storage-persister (v5.90.18):**
- Creates a synchronous persister compatible with TanStack Query v5
- `createSyncStoragePersister({ storage: { getItem, setItem, removeItem }, throttleTime })`
- `throttleTime` controls write frequency (default: 1000ms) — prevents excessive MMKV writes during rapid state changes
- `key` option: defaults to `"REACT_QUERY_OFFLINE_CACHE"` — customizable if needed

**@tanstack/react-query-persist-client (v5.90.18):**
- Provides `PersistQueryClientProvider` — drop-in replacement for `QueryClientProvider`
- `persistOptions`: `{ persister, maxAge, dehydrateOptions }`
- `maxAge`: default 24 hours (1000 * 60 * 60 * 24) — how long to keep persisted cache
- `dehydrateOptions.shouldDehydrateQuery`: filter which queries to persist
- Cache is hydrated synchronously on mount when using sync persister — no loading flash

**@react-native-community/netinfo:**
- Standard React Native library for network status detection
- `useNetInfo()` hook: returns `{ isConnected, isInternetReachable, type, details }`
- `NetInfo.addEventListener(callback)`: subscribe to connectivity changes
- `NetInfo.fetch()`: one-time check (returns Promise)
- Works with Expo managed workflow
- `isConnected: boolean | null` — null means undetermined (treat as true)

**expo-image caching (already in use):**
- expo-image has built-in disk caching — images fetched once are cached automatically
- `cachePolicy="memory-disk"` is the default — garment thumbnails persist across app sessions
- No additional configuration needed for offline image display
- Cache is separate from TanStack Query cache — persist handles data, expo-image handles images

### Dependencies

**This story depends on:**
- Story 2.1 (garments table + garmentRouter + upload mutation) — DONE
- Story 2.2 (WardrobeScreen + LegendList grid + pull-to-refresh) — DONE
- Story 2.3 (stock garments + WardrobeItem types) — DONE
- Story 2.4 (delete garment + offline error handling) — DONE

**Stories that depend on this story:**
- Story 3.1 (Garment Detail Bottom Sheet) — will consume `assertOnline` utility for "Try On" offline guard
- Story 3.2 (AI Render Pipeline) — client polling needs offline awareness
- Epic 5 (Onboarding) — may leverage persist for onboarding state

### References

- [Source: epics.md#Story 2.5] — Story definition and all 7 original acceptance criteria
- [Source: prd.md#FR9] — User can browse their garment collection offline
- [Source: prd.md#FR26] — User's wardrobe data and garment thumbnails are cached locally
- [Source: prd.md#FR27] — User's garment photos are stored securely on the server
- [Source: prd.md#NFR4] — Local wardrobe browsing works offline with no perceptible delay
- [Source: architecture.md#Data Architecture] — TanStack Query persist + MMKV, expo-image caching
- [Source: architecture.md#Frontend Architecture] — Offline cache specification
- [Source: architecture.md#Process Patterns] — Loading states: isLoading vs isFetching
- [Source: architecture.md#Enforcement Guidelines] — TanStack Query states, no useState for loading
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions
- [Source: CLAUDE.md] — All critical implementation rules
- [Source: 2-4-remove-garment.md] — 292 tests, offline delete = error toast (not queued)
- [Source: 2-3-stock-garment-library.md] — Stock garments always offline-available
- [Source: 2-2-wardrobe-grid-and-category-browsing.md] — WardrobeScreen patterns, isLoading skeleton
- [Source: 2-1-add-garment-with-photo-capture.md] — garment.upload mutation, compression pipeline
- [Source: apps/expo/src/utils/api.tsx:11-17] — Current QueryClient configuration
- [Source: apps/expo/src/app/_layout.tsx:43-49] — Current QueryClientProvider in root layout
- [Source: apps/expo/src/app/(auth)/(tabs)/index.tsx] — WardrobeScreen with useQuery
- [Source: apps/expo/src/app/(auth)/(tabs)/add.tsx] — Add garment with upload mutation
- [Source: apps/expo/test/setup.ts] — Test preload with existing mocks

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- react-native-mmkv API changed: `MMKV` class replaced by `createMMKV()` factory function, `.delete()` renamed to `.remove()`
- `mock.restore()` in bun:test does not fully restore `spyOn` on module exports from `mock.module()` — use explicit spy values per test

### Completion Notes List

- **Task 1**: Installed `react-native-mmkv`, created MMKV singleton (`createMMKV`), added mock to test setup
- **Task 2**: Installed TanStack Query persist packages, created MMKV-based sync persister with `throttleTime: 1000`, set `gcTime: 24h` on QueryClient, replaced `QueryClientProvider` with `PersistQueryClientProvider` in root layout
- **Task 3**: Installed `@react-native-community/netinfo`, created `useNetworkStatus` hook with offline→online transition detection via `onReconnect` callback
- **Task 4**: Added offline indicator banner to WardrobeScreen, pull-to-refresh shows "No internet" toast when offline, cached data renders without skeleton during background refetch
- **Task 5**: Implemented MMKV-persisted upload queue (`enqueueUpload`, `processQueue`, `getQueueLength`, `clearQueue`), wired offline queuing in AddGarmentScreen with info toast
- **Task 6**: Created `assertOnline` utility for Story 3.1 consumption — checks NetInfo.fetch(), shows error toast with configurable message when offline
- **Task 7**: Created `useReconnectSync` hook — invalidates garment queries, processes upload queue, shows "Back online" toast on reconnect. Wired in `(auth)/_layout.tsx`
- **Task 8**: Full typecheck (13/13), full test suite (167 tests, 0 failures), all ACs satisfied

### Change Log

- 2026-02-16: Implemented Story 2.5 — Offline Browsing & Data Sync. Added TanStack Query persist with MMKV, network detection, offline upload queuing, reconnection sync, and offline UI indicators.

### File List

**New files:**
- `apps/expo/src/utils/mmkv.ts` — MMKV singleton instance
- `apps/expo/src/utils/query-persister.ts` — TanStack Query sync persister with MMKV adapter
- `apps/expo/src/utils/query-persister.test.ts` — Persister tests
- `apps/expo/src/utils/api.test.ts` — QueryClient configuration tests
- `apps/expo/src/utils/upload-queue.ts` — MMKV-persisted offline upload queue
- `apps/expo/src/utils/upload-queue.test.ts` — Upload queue tests
- `apps/expo/src/utils/assertOnline.ts` — Reusable online guard utility
- `apps/expo/src/utils/assertOnline.test.ts` — assertOnline tests
- `apps/expo/src/hooks/useNetworkStatus.ts` — Network connectivity hook
- `apps/expo/src/hooks/useNetworkStatus.test.ts` — Network hook tests
- `apps/expo/src/hooks/useReconnectSync.ts` — Reconnection sync logic
- `apps/expo/src/hooks/useReconnectSync.test.ts` — Reconnect sync tests

**Modified files:**
- `apps/expo/src/utils/api.tsx` — Added `gcTime: 24h` to QueryClient defaults
- `apps/expo/src/app/_layout.tsx` — Replaced `QueryClientProvider` with `PersistQueryClientProvider`
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Added offline indicator, conditional pull-to-refresh
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — Added offline-awareness tests
- `apps/expo/src/app/(auth)/(tabs)/add.tsx` — Added offline upload queuing
- `apps/expo/src/app/(auth)/_layout.tsx` — Wired `useReconnectSync` hook
- `apps/expo/test/setup.ts` — Added MMKV, NetInfo, persist, cuid2 mocks
- `apps/expo/package.json` — New dependencies
- `pnpm-lock.yaml` — Updated lockfile
