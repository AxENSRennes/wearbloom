# Story 2.4: Remove Garment

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to remove a garment from my wardrobe,
So that I can keep my collection clean and relevant.

## Acceptance Criteria

1. **Given** the user long-presses a personal garment in the wardrobe grid **When** the confirmation dialog appears **Then** an AlertDialog with destructive styling asks "Delete Garment?" with "Delete" (red) and "Cancel" buttons **And** light haptic feedback triggers on long-press

2. **Given** the user confirms deletion **When** the delete action executes **Then** the garment record is removed from the garments table **And** the original photo and cutout are deleted from the server filesystem **And** the garment is removed from the local TanStack Query cache

3. **Given** the deletion completes **When** the wardrobe grid updates **Then** the garment is no longer visible **And** the grid re-renders without layout shift **And** a success toast "Garment deleted" appears (2s)

4. **Given** a deletion fails (network error) **When** the error occurs **Then** an error toast is shown ("Couldn't delete. Try again.") **And** the garment remains in the wardrobe **And** the AlertDialog closes

5. **Given** a stock garment **When** the user long-presses it **Then** no delete option appears (stock garments are not deletable)

## Tasks / Subtasks

- [x] Task 1: Add `garment.delete` tRPC procedure (AC: #2, #4)
  - [x] 1.1 Write failing tests in `packages/api/src/router/garment.test.ts` (TDD RED phase):
    - Test: successful deletion returns `{ success: true }`, calls `deleteGarmentFiles` and DB delete
    - Test: non-existent garment throws TRPCError `NOT_FOUND`
    - Test: garment owned by another user throws TRPCError `NOT_FOUND`
    - Test: unauthenticated request throws `UNAUTHORIZED`
    - Test: filesystem deletion failure throws TRPCError `INTERNAL_SERVER_ERROR`
    - Test: `deleteGarmentFiles` is called with correct `(userId, garmentId)` args
  - [x] 1.2 Add `delete` procedure to `packages/api/src/router/garment.ts` as `protectedProcedure`
  - [x] 1.3 Input schema: `z.object({ garmentId: z.string() })` (import z from `"zod/v4"`)
  - [x] 1.4 Ownership check: query garment by `id + userId`, throw `TRPCError({ code: "NOT_FOUND" })` if not found
  - [x] 1.5 Delete filesystem FIRST: `ctx.imageStorage.deleteGarmentFiles(userId, garmentId)` — prevents orphaned files
  - [x] 1.6 Delete DB record: `ctx.db.delete(garments).where(and(eq(garments.id, input.garmentId), eq(garments.userId, userId)))`
  - [x] 1.7 Return `{ success: true }`
  - [x] 1.8 Wrap in try-catch, throw `TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "GARMENT_DELETION_FAILED" })` on failure
  - [x] 1.9 Run tests — all GREEN

- [x] Task 2: Add `onLongPress` to GarmentCard component (AC: #1, #5)
  - [x] 2.1 Write failing tests in `apps/expo/src/components/garment/GarmentCard.test.tsx` (TDD RED phase):
    - Test: long-press callback fires when `onLongPress` prop is provided
    - Test: no crash when `onLongPress` is undefined (stock garment scenario)
  - [x] 2.2 Add optional `onLongPress?: () => void` prop to `GarmentCardProps` interface
  - [x] 2.3 Wire `onLongPress` to `Pressable`'s `onLongPress` prop
  - [x] 2.4 Add `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` on long-press (import from `expo-haptics`)
  - [x] 2.5 Run tests — all GREEN

- [x] Task 3: Implement delete flow in WardrobeScreen (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Write failing tests in `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` (TDD RED phase):
    - Test: long-press on personal garment sets garmentToDelete state (AlertDialog opens)
    - Test: long-press on stock garment does NOT trigger delete dialog
    - Test: confirming deletion calls `garment.delete` mutation with correct garmentId
    - Test: successful deletion shows success toast and invalidates garment.list query
    - Test: failed deletion shows error toast and garment remains
    - Test: AlertDialog shows with destructive variant and correct labels
    - Test: AlertDialog cancel button clears garmentToDelete
  - [x] 3.2 Add state: `const [garmentToDelete, setGarmentToDelete] = useState<PersonalGarment | null>(null)`
  - [x] 3.3 Create delete mutation: `useMutation(trpc.garment.delete.mutationOptions({ ... }))`
  - [x] 3.4 In `onSuccess`: clear garmentToDelete, invalidate `trpc.garment.list.queryKey()`, show success toast
  - [x] 3.5 In `onError`: clear garmentToDelete, show error toast
  - [x] 3.6 Pass `onLongPress` to GarmentCard in `renderGarment` — only for personal garments (`!isStockGarment(item)`)
  - [x] 3.7 Add `AlertDialog` from `@acme/ui` with: `isOpen={garmentToDelete !== null}`, `variant="destructive"`, `title="Delete Garment"`, `message="This garment will be permanently removed from your wardrobe."`, `confirmLabel="Delete"`, `isLoading={deleteMutation.isPending}`
  - [x] 3.8 Run tests — all GREEN

- [x] Task 4: Typecheck, test, and validation (AC: all)
  - [x] 4.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x] 4.2 Run `turbo test` — all tests pass, 0 regressions (292 tests total: 68 API + 148 Expo + cached)
  - [x] 4.3 Verify personal garment long-press → AlertDialog → Delete → garment removed from grid
  - [x] 4.4 Verify stock garments have no long-press delete behavior
  - [x] 4.5 Verify error handling shows toast on network failure
  - [x] 4.6 Verify grid re-renders without layout shift after deletion

## Dev Notes

### Story Context & Purpose

This story implements **FR10** (user can remove a garment from their wardrobe). It is the **fourth story in Epic 2** (Wardrobe Management) and provides wardrobe maintenance capability.

This is a **full-stack story**: server-side tRPC procedure + client-side UI interaction. The backend `imageStorage.deleteGarmentFiles()` method already exists (created during Story 2.1) and has never been called — this story is its first real consumer.

**Scope boundaries:**
- **IN scope**: Delete personal garments via long-press → confirmation → server deletion + cache invalidation
- **OUT of scope**: Stock garment deletion (they're client-side constants, not deletable), batch deletion, undo, garment detail bottom sheet (Story 3.1)

[Source: epics.md#Story 2.4 — "Remove a garment from my wardrobe"]
[Source: prd.md#FR10 — "User can remove a garment from their wardrobe"]

### Architecture Decisions

**Long-Press Interaction Pattern (NOT tap-to-delete)**

The AC says "Given the user is viewing a garment detail, When they choose to delete the garment." However, Story 3.1 (Garment Detail Bottom Sheet) is in Epic 3 and has NOT been implemented yet. The `onPress` handler in WardrobeScreen is currently an empty placeholder reserved for Story 3.1.

**Decision: Use long-press on GarmentCard to trigger deletion.**

Rationale:
- Preserves the `onPress` slot for Story 3.1 (tap → detail bottom sheet)
- Long-press is a standard iOS pattern for destructive actions (context menus)
- Prevents accidental deletion (deliberate gesture required)
- When Story 3.1 arrives, the delete button can also be added to the detail sheet; long-press remains as a shortcut or can be removed

[Source: architecture.md#Frontend Architecture — gesture-handler v2 for interactions]
[Source: ux-design-specification.md — "destructive action styling (red action button per Gluestack AlertDialog)"]

**Filesystem Delete Before Database Delete**

Following the established pattern from `deleteAccount` in `packages/api/src/router/user.ts` (lines 120-145): delete files from disk FIRST, then delete the DB record. This prevents orphaned files — if FS delete succeeds but DB delete fails, we can retry; if DB deletes first but FS fails, we have orphaned files with no reference.

```typescript
// Established pattern from user.ts deleteAccount:
// 1. Delete filesystem first → prevents orphaned files
await ctx.imageStorage.deleteGarmentFiles(userId, garmentId);
// 2. Delete DB record second
await ctx.db.delete(garments).where(eq(garments.id, garmentId));
```

[Source: packages/api/src/router/user.ts:120-145 — deleteAccount pattern]

**TanStack Query Cache Invalidation (NOT Optimistic Update)**

On successful deletion, invalidate the `garment.list` query to trigger a refetch. Do NOT use optimistic updates for deletion because:
- Deletion is destructive and irreversible — we want server confirmation first
- The AlertDialog's `isLoading` state provides adequate UX during the brief server call
- Simpler implementation with fewer edge cases

```typescript
// onSuccess handler:
void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
```

[Source: architecture.md#Process Patterns — TanStack Query states for loading management]

### Backend Implementation

**New procedure: `garment.delete`**

Location: `packages/api/src/router/garment.ts`

```typescript
delete: protectedProcedure
  .input(z.object({ garmentId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    // 1. Verify garment exists and belongs to user
    const [garment] = await ctx.db
      .select({ id: garments.id })
      .from(garments)
      .where(and(eq(garments.id, input.garmentId), eq(garments.userId, userId)))
      .limit(1);

    if (!garment) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    try {
      // 2. Delete filesystem first (prevent orphaned files)
      if (ctx.imageStorage) {
        await ctx.imageStorage.deleteGarmentFiles(userId, input.garmentId);
      }

      // 3. Delete DB record
      await ctx.db
        .delete(garments)
        .where(
          and(eq(garments.id, input.garmentId), eq(garments.userId, userId)),
        );

      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "GARMENT_DELETION_FAILED",
        cause: error,
      });
    }
  }),
```

**Key details:**
- `protectedProcedure` — requires authenticated session
- Ownership check via compound WHERE clause (`id + userId`) — never expose another user's garments
- `deleteGarmentFiles` already exists in `packages/api/src/services/imageStorage.ts` (lines 119-141). It deletes `{garmentId}_original.{jpg|png}` and `{garmentId}_cutout.{jpg|png}` from `/data/images/{userId}/garments/`. Files that don't exist are silently skipped.
- Return `{ success: true }` on success — the client doesn't need the deleted garment data

[Source: packages/api/src/services/imageStorage.ts:119-141 — deleteGarmentFiles implementation]
[Source: packages/api/src/router/garment.ts — existing upload, list, getGarment procedures]

### Frontend Implementation

**GarmentCard changes** (`apps/expo/src/components/garment/GarmentCard.tsx`):

```typescript
import * as Haptics from "expo-haptics";

interface GarmentCardProps {
  garment: WardrobeItem;
  onPress: () => void;
  onLongPress?: () => void;  // NEW — optional, only for personal garments
  columnWidth: number;
}

export function GarmentCard({ garment, onPress, onLongPress, columnWidth }: GarmentCardProps) {
  const handleLongPress = useCallback(() => {
    if (onLongPress) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onLongPress();
    }
  }, [onLongPress]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      // ... existing props unchanged
    >
      {/* ... existing content unchanged */}
    </Pressable>
  );
}
```

**expo-haptics:** Already available in Expo managed workflow, no install needed. Import `expo-haptics` and call `Haptics.impactAsync()`. Check if it's already in the project dependencies; if not, add with `pnpm add expo-haptics --filter @acme/expo`.

[Source: ux-design-specification.md — "Haptic feedback: light on press"]

**WardrobeScreen changes** (`apps/expo/src/app/(auth)/(tabs)/index.tsx`):

```typescript
import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertDialog } from "@acme/ui";
import { showToast } from "@acme/ui";
import type { PersonalGarment } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";

export default function WardrobeScreen() {
  // ... existing state ...
  const [garmentToDelete, setGarmentToDelete] = useState<PersonalGarment | null>(null);

  const deleteMutation = useMutation(
    trpc.garment.delete.mutationOptions({
      onSuccess: () => {
        setGarmentToDelete(null);
        void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
        showToast({ message: "Garment deleted", variant: "success" });
      },
      onError: () => {
        setGarmentToDelete(null);
        showToast({ message: "Couldn't delete. Try again.", variant: "error" });
      },
    }),
  );

  const handleDeleteConfirm = useCallback(() => {
    if (garmentToDelete) {
      deleteMutation.mutate({ garmentId: garmentToDelete.id });
    }
  }, [garmentToDelete, deleteMutation]);

  const renderGarment = useCallback(
    ({ item }: { item: WardrobeItem }) => (
      <GarmentCard
        garment={item}
        onPress={() => {
          // Story 3.1 will implement garment detail bottom sheet
        }}
        onLongPress={
          !isStockGarment(item)
            ? () => setGarmentToDelete(item as PersonalGarment)
            : undefined
        }
        columnWidth={COLUMN_WIDTH}
      />
    ),
    [],
  );

  return (
    <>
      {/* ... existing LegendList JSX ... */}
      <AlertDialog
        isOpen={garmentToDelete !== null}
        onClose={() => setGarmentToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Garment"
        message="This garment will be permanently removed from your wardrobe."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
```

**Key frontend details:**
- `garmentToDelete` state controls AlertDialog visibility — `null` = closed, non-null = open
- Only personal garments get `onLongPress` handler (stock garments receive `undefined`)
- `deleteMutation.isPending` disables both buttons and shows spinner in AlertDialog during server call
- Cache invalidation via `invalidateQueries` triggers LegendList data update — grid re-renders naturally without layout shift
- `showToast` imported from `@acme/ui` — success (2s), error (4s) per established durations

[Source: packages/ui/src/alert-dialog.tsx — AlertDialog component with destructive variant]
[Source: packages/ui/src/toast.tsx — showToast function with variant-based durations]

### Existing Code References

| Component | Location | Relevance |
|-----------|----------|-----------|
| `garments` table schema | `packages/db/src/schema.ts:91-110` | DB table to delete from |
| `garmentRouter` (upload, list, getGarment) | `packages/api/src/router/garment.ts:18-219` | Add `delete` procedure here |
| `imageStorage.deleteGarmentFiles()` | `packages/api/src/services/imageStorage.ts:119-141` | Already implemented — deletes `{garmentId}_original` + `{garmentId}_cutout` files |
| `deleteAccount` pattern | `packages/api/src/router/user.ts:120-145` | Reference for FS-first-then-DB deletion pattern |
| `GarmentCard` component | `apps/expo/src/components/garment/GarmentCard.tsx:15-79` | Add `onLongPress` prop |
| `WardrobeScreen` | `apps/expo/src/app/(auth)/(tabs)/index.tsx:26-127` | Add delete state, mutation, AlertDialog |
| `AlertDialog` | `packages/ui/src/alert-dialog.tsx:52-148` | Use with `variant="destructive"` |
| `showToast` | `packages/ui/src/toast.tsx:26-28` | Success/error toast feedback |
| `WardrobeItem` / `PersonalGarment` types | `apps/expo/src/types/wardrobe.ts:1-16` | Type for garmentToDelete state |
| `isStockGarment` type guard | `apps/expo/src/types/wardrobe.ts:12-14` | Guard to prevent stock garment deletion |
| `createMockImageStorage` | `packages/api/src/router/garment.test.ts:27-42` | Already has `deleteGarmentFiles` mock |
| `tRPC context` | `packages/api/src/trpc.ts` | Provides `{ db, session, imageStorage }` |

### Project Structure Notes

**Files to modify:**
```
packages/api/src/router/garment.ts          — Add delete procedure
packages/api/src/router/garment.test.ts     — Add delete procedure tests
apps/expo/src/components/garment/GarmentCard.tsx      — Add onLongPress prop
apps/expo/src/components/garment/GarmentCard.test.tsx  — Add long-press tests
apps/expo/src/app/(auth)/(tabs)/index.tsx              — Add delete state, mutation, AlertDialog
apps/expo/src/app/(auth)/(tabs)/index.test.tsx         — Add delete flow tests
```

**No new files needed** — this story only modifies existing files.

**Alignment with architecture:**
- Backend procedure in `router/garment.ts` — per domain-based router organization
- Service call via `ctx.imageStorage` — respects architectural boundary (routers → services → filesystem)
- Tests co-located with source files
- All imports from `bun:test`
- AlertDialog from `@acme/ui` — shared component library
- TRPCError for all server errors — never generic `throw new Error()`

[Source: architecture.md#Structure Patterns — project organization]
[Source: CLAUDE.md#Code Organization — domain-based component structure]

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**Backend tests (`garment.test.ts` additions):**

```typescript
describe("garment.delete", () => {
  // Test: successful deletion — returns { success: true }
  //   Verify deleteGarmentFiles called with (userId, garmentId)
  //   Verify db.delete called with correct where clause

  // Test: garment not found — throws TRPCError NOT_FOUND
  //   Mock db.select to return empty array
  //   Verify deleteGarmentFiles NOT called

  // Test: garment belongs to another user — throws TRPCError NOT_FOUND
  //   Mock db.select to return empty (compound WHERE fails)

  // Test: unauthenticated — throws UNAUTHORIZED
  //   Call with unauthenticated caller

  // Test: imageStorage.deleteGarmentFiles throws — throws INTERNAL_SERVER_ERROR
  //   Mock deleteGarmentFiles to reject
  //   Verify db.delete NOT called (error before DB step)
});
```

**Use existing test helpers:** The `garment.test.ts` already has `createAuthenticatedCaller()`, `createUnauthenticatedCaller()`, `createMockImageStorage()` (which already includes a `deleteGarmentFiles` mock). Reuse these for the delete tests.

**Frontend tests additions:**

```typescript
// GarmentCard.test.tsx
// Test: long-press fires onLongPress callback
// Test: no crash when onLongPress is undefined

// index.test.tsx (WardrobeScreen)
// Test: long-press on personal garment triggers setGarmentToDelete
// Test: long-press on stock garment does NOT trigger delete
// Test: AlertDialog renders with destructive variant when garmentToDelete is set
// Test: confirm calls garment.delete mutation
// Test: cancel clears garmentToDelete
// Test: success shows toast and invalidates queries
// Test: error shows error toast
```

**Test patterns to follow:**
- Use `spyOn` + `mockRestore()` in `afterEach` for reversible mocks
- Use `mock()` for function mocks
- Mock tRPC queries/mutations at the hook level using the established pattern from Story 2.2/2.3 tests
- Use `@testing-library/react-native` `fireEvent.longPress()` for simulating long-press

[Source: packages/api/src/router/garment.test.ts — existing test infrastructure]
[Source: apps/expo/src/app/(auth)/(tabs)/index.test.tsx — WardrobeScreen test patterns]

### Key Pitfalls to Avoid

1. **DO NOT allow deletion of stock garments.** Stock garments are client-side constants with `isStock: true`. The `onLongPress` prop must be `undefined` for stock items. The server procedure doesn't even know about stock garments.

2. **DO NOT use `onPress` for deletion.** The `onPress` handler is reserved for Story 3.1 (Garment Detail Bottom Sheet). Use `onLongPress` exclusively.

3. **DO NOT use optimistic updates for deletion.** Deletion is destructive. Wait for server confirmation via `onSuccess` before updating the cache.

4. **DO NOT forget to delete filesystem BEFORE database.** Follow the established pattern: `deleteGarmentFiles()` first, then `db.delete()`. This prevents orphaned files.

5. **DO NOT use `useState` for loading state.** Use `deleteMutation.isPending` from TanStack Query. Pass it as `isLoading` to AlertDialog.

6. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

7. **DO NOT use `console.log` on the server.** Use `logger.info()` / `logger.error()` from pino.

8. **DO NOT create a separate `__tests__/` directory.** Co-locate all tests next to source files.

9. **DO NOT import test utilities from `"vitest"` or `"@jest/globals"`.** Always `import { ... } from "bun:test"`.

10. **DO NOT throw generic `new Error()` in the tRPC procedure.** Always use `TRPCError` with specific codes.

11. **DO NOT forget the compound WHERE clause in the delete query.** Always include both `garments.id === garmentId` AND `garments.userId === userId` to prevent unauthorized deletion.

12. **DO NOT call `deleteGarmentFiles` if `ctx.imageStorage` is undefined.** Guard with `if (ctx.imageStorage)` check (follows deleteAccount pattern).

13. **DO NOT close AlertDialog on mutation start.** Keep it open with `isLoading={deleteMutation.isPending}` until success/error resolves. Close it in `onSuccess` and `onError`.

14. **DO NOT forget haptic feedback on long-press.** Import `expo-haptics` and call `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`.

### Previous Story Intelligence

**From Story 2.3 (Stock Garment Library) — CRITICAL:**

- **Stock garments are NOT deletable** — Story 2.3 Dev Notes explicitly state: "Story 2.4 (Remove Garment) — stock garments should NOT be removable (no delete option)"
- `isStockGarment()` type guard at `apps/expo/src/types/wardrobe.ts:12-14` — use this to conditionally pass `onLongPress`
- `WardrobeItem` = `PersonalGarment | StockGarment` — discriminated union on `isStock`
- `PersonalGarment` includes all DB fields: `id`, `userId`, `category`, `imagePath`, `cutoutPath`, `bgRemovalStatus`, etc.
- Current test count: **280 tests** across all packages (post Story 2.3)
- `categories.ts` at `apps/expo/src/constants/categories.ts` — shared GarmentCategory type

**From Story 2.2 (Wardrobe Grid) — REFERENCE:**

- `WardrobeScreen` at `apps/expo/src/app/(auth)/(tabs)/index.tsx` — fetches garments via `useQuery(trpc.garment.list.queryOptions(...))`, renders in LegendList
- `queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() })` — established pattern for refresh (used in pull-to-refresh)
- `GarmentCard` press animation uses Reanimated — `onPressIn` / `onPressOut` for scale animation. Adding `onLongPress` to Pressable should not interfere with press animation.
- `EmptyState` component unchanged — after deletion, if all personal garments are removed, stock garments still prevent the "all" empty state. Category-specific empty state may appear if last personal garment in a category is deleted.

**From Story 2.1 (Add Garment) — REFERENCE:**

- `garmentRouter` procedures: `upload`, `list`, `getGarment` — adding `delete` follows the same pattern
- `createMockImageStorage()` in tests already has `deleteGarmentFiles: mock(() => Promise.resolve())`
- `createAuthenticatedCaller()` / `createUnauthenticatedCaller()` helpers — reuse for delete tests
- DB mock pattern: `spyOn(db, "select")`, `spyOn(db, "delete")` with mock chain

**From Story 1.6 (Account Deletion) — PATTERN:**

- `deleteAccount` at `packages/api/src/router/user.ts:120-145` — the deletion pattern to follow
- Filesystem first, then DB: `await ctx.imageStorage.deleteUserDirectory(userId)` → `await ctx.db.delete(users).where(...)`
- Error wrapping: `try { ... } catch (error) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", ... }) }`
- AlertDialog with destructive variant used for confirmation — same component reused here

### Git Intelligence

**Recent commits (5):**
1. `52aec1d` — fix: Story 2.3 code review — 8 issues resolved (5M/3L), status done
2. `ff086b2` — feat: implement Story 2.3 — Stock Garment Library
3. `65dd633` — fix: Story 2.2 code review — 7 issues resolved (2H/5M), status done
4. `106e6b6` — feat: implement Story 2.2 — Wardrobe Grid & Category Browsing
5. `10c370d` — fix: Story 2.1 code review #3 — placeholder tests rewritten, pgEnum, error handling

**Patterns from recent work:**
- Conventional commit messages: `feat:` for implementation, `fix:` for code review
- Code review consistently catches: placeholder tests (write real behavioral tests), missing error handling, accessibility gaps
- `spyOn` pattern for mocking DB and service methods in router tests
- DI pattern for server services (`ctx.imageStorage` injected via context)
- All 13/13 packages typecheck clean, 280+ tests pass

**Files recently modified (relevant to this story):**
- `packages/api/src/router/garment.ts` — Created in Story 2.1, unchanged since. Adding `delete` procedure.
- `packages/api/src/router/garment.test.ts` — Created in Story 2.1. Adding delete procedure tests.
- `apps/expo/src/components/garment/GarmentCard.tsx` — Modified in Story 2.3 (WardrobeItem support). Adding `onLongPress`.
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Modified in Story 2.3 (stock garment merge). Adding delete state + AlertDialog.

### Latest Tech Information

**expo-haptics (Expo SDK 54):**
- Part of Expo managed workflow — no native module installation needed
- Import: `import * as Haptics from "expo-haptics"`
- Light impact: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` — appropriate for button/long-press feedback
- Async function — use `void Haptics.impactAsync(...)` to avoid floating promise lint warning
- In tests: mock with `mock.module("expo-haptics", () => ({ impactAsync: mock(() => Promise.resolve()) }))`

**React Native Pressable `onLongPress`:**
- Built-in prop on `Pressable` — no gesture handler needed
- Default `delayLongPress` is 500ms (standard iOS). No need to customize.
- Works alongside `onPress`, `onPressIn`, `onPressOut` without interference
- The Reanimated press animation (scale 0.97x) will NOT conflict with long-press — `onPressIn` fires immediately, long-press fires after 500ms hold

**TanStack Query `invalidateQueries`:**
- `void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() })` — invalidates ALL `garment.list` queries regardless of category filter parameter
- This triggers a background refetch — `isFetching` becomes true briefly, `isLoading` stays false (data already exists)
- LegendList updates seamlessly — the deleted item disappears without layout shift because the data array shrinks by one and LegendList re-renders

### Dependencies

**This story depends on:**
- Story 2.1 (garments table + garmentRouter + imageStorage.deleteGarmentFiles) — DONE
- Story 2.2 (WardrobeScreen + GarmentCard + LegendList grid) — DONE
- Story 2.3 (WardrobeItem type + stock garment handling) — DONE
- Story 1.6 (AlertDialog component + delete pattern) — DONE

**Stories that depend on this story:**
- Story 3.1 (Garment Detail Bottom Sheet) — may add a delete button to the sheet alongside long-press
- Story 2.5 (Offline Browsing) — offline delete may need queuing (but that's a 2.5 concern)

### References

- [Source: epics.md#Story 2.4] — Story definition and all 4 original acceptance criteria
- [Source: prd.md#FR10] — User can remove a garment from their wardrobe
- [Source: architecture.md#API Patterns] — TRPCError + typed business codes
- [Source: architecture.md#Data Architecture] — Image storage on VPS filesystem
- [Source: architecture.md#Structure Patterns] — Router/service/component organization
- [Source: architecture.md#Naming Patterns] — camelCase TS, snake_case DB
- [Source: architecture.md#Process Patterns] — TanStack Query states, no useState for loading
- [Source: architecture.md#Enforcement Guidelines] — Anti-patterns to avoid
- [Source: ux-design-specification.md#Haptic Feedback] — Light haptic on press
- [Source: ux-design-specification.md#Toast Notifications] — Success 2s, error 4s
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions
- [Source: CLAUDE.md] — All critical implementation rules
- [Source: 2-3-stock-garment-library.md] — Stock garments NOT deletable, WardrobeItem type, 280 tests
- [Source: 2-2-wardrobe-grid-and-category-browsing.md] — WardrobeScreen, GarmentCard, LegendList patterns
- [Source: 2-1-add-garment-with-photo-capture.md] — garmentRouter, imageStorage, test helpers
- [Source: 1-6-account-deletion.md] — AlertDialog destructive variant, delete pattern (FS then DB)
- [Source: packages/api/src/services/imageStorage.ts:119-141] — deleteGarmentFiles implementation
- [Source: packages/api/src/router/user.ts:120-145] — deleteAccount pattern reference
- [Source: packages/ui/src/alert-dialog.tsx:52-148] — AlertDialog component API
- [Source: packages/ui/src/toast.tsx:26-28] — showToast function API

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- RED phase confirmed for Task 1: 6 tests failed with "No procedure found on path 'garment,delete'"
- GREEN phase: All 25 garment router tests pass after adding `delete` procedure
- `expo-haptics` not installed — added via `pnpm add expo-haptics --filter @acme/expo`
- Added `expo-haptics` mock to `apps/expo/test/setup.ts` for SSR test compatibility
- Typecheck: 13/13 packages pass
- Full test suite: 8/8 packages pass, 0 failures, 0 regressions

### Completion Notes List

- **Task 1:** Added `garment.delete` protectedProcedure with ownership check, FS-first-then-DB deletion pattern, TRPCError handling. 6 unit tests cover success, NOT_FOUND (missing + wrong owner), UNAUTHORIZED, INTERNAL_SERVER_ERROR (FS failure), and correct args verification.
- **Task 2:** Added `onLongPress` optional prop to GarmentCard with haptic feedback (`expo-haptics` Light impact). Wrapped in `useCallback` to prevent re-renders. 2 tests added.
- **Task 3:** Implemented full delete flow in WardrobeScreen: `garmentToDelete` state, `useMutation` with `onSuccess`/`onError` handlers (cache invalidation, toast notifications), `AlertDialog` with destructive variant, conditional `onLongPress` only for personal garments via `isStockGarment` guard. 4 tests added.
- **Task 4:** Typecheck 13/13, full test suite 0 failures, all ACs verified.

### File List

- `packages/api/src/router/garment.ts` — Added `delete` protectedProcedure (mutation)
- `packages/api/src/router/garment.test.ts` — Added 6 tests for garment.delete + mockDbDelete helper
- `apps/expo/src/components/garment/GarmentCard.tsx` — Added `onLongPress` prop, haptic feedback, `useCallback` handler
- `apps/expo/src/components/garment/GarmentCard.test.tsx` — Added 2 tests for onLongPress behavior
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Added delete state, mutation, AlertDialog, conditional onLongPress
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — Added 4 tests for delete flow
- `apps/expo/test/setup.ts` — Added expo-haptics mock
- `apps/expo/package.json` — Added expo-haptics dependency
- `pnpm-lock.yaml` — Updated lockfile
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Status: ready-for-dev → in-progress → review

### Change Log

- **2026-02-16:** Implemented Story 2.4 — Remove Garment. Added `garment.delete` tRPC procedure (FS-first-then-DB pattern), `onLongPress` with haptic feedback on GarmentCard, delete flow with AlertDialog in WardrobeScreen, stock garment protection. 12 new tests, 0 regressions.
- **2026-02-16:** Code review — 6 issues resolved (2H/4M). Fixed: WardrobeScreen delete tests now verify mutation callbacks via spyOn (H1/H2), imageStorage guard throws instead of silently skipping (M1), FS failure test verifies DB delete NOT called (M2), GarmentCard accessibilityHint conditional for long-press (M3), test names corrected (M4). Added NOT_FOUND message consistency (L2). Status: done.
