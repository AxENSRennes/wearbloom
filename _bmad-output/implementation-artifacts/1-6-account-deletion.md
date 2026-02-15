# Story 1.6: Account Deletion

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to delete my account and all associated data,
So that my personal information is completely and permanently removed.

## Acceptance Criteria

1. **Given** the user is in account settings **When** they tap "Delete Account" **Then** a confirmation alert dialog appears with destructive action styling (red action button per Gluestack AlertDialog)

2. **Given** the confirmation dialog **When** the user confirms deletion **Then** the cascading delete pipeline executes: user record → body photos → garment photos → renders → wardrobe metadata → usage history (NFR8)

3. **Given** the deletion completes **When** all data is removed **Then** no files or database records remain for this user on the server

4. **Given** the account is deleted **When** the user returns to the app **Then** they are signed out and see the welcome/onboarding screen

5. **Given** a deletion is in progress **When** the user waits **Then** a loading spinner is shown in the button until confirmation of completion

## Tasks / Subtasks

- [x] Task 1: Add `deleteUserDirectory` method to imageStorage service (AC: #2, #3)
  - [x] 1.1 Extend `createImageStorage` in `packages/api/src/services/imageStorage.ts` with `deleteUserDirectory(userId: string): Promise<void>` — recursively removes `{basePath}/{userId}/` directory using `rm(path, { recursive: true, force: true })`
  - [x] 1.2 Log deletion with pino: `logger.info({ userId }, "User directory deleted from disk")`
  - [x] 1.3 Handle missing directory gracefully (no error if dir doesn't exist — `force: true` handles this)
  - [x] 1.4 Update `ImageStorage` interface in `packages/api/src/trpc.ts` — add `deleteUserDirectory(userId: string): Promise<void>`
  - [x] 1.5 Write co-located test in `imageStorage.test.ts` — test deleteUserDirectory removes directory, test no error when directory missing

- [x] Task 2: Add `deleteAccount` procedure to user router (AC: #2, #3)
  - [x] 2.1 Add `deleteAccount` mutation to `packages/api/src/router/user.ts`:
    - Auth: `protectedProcedure` (requires active session)
    - Input: none
    - Logic:
      1. Get `userId` from `ctx.session.user.id`
      2. Delete all filesystem files: `ctx.imageStorage.deleteUserDirectory(userId)`
      3. Delete user record from `users` table: `ctx.db.delete(users).where(eq(users.id, userId))`
      4. DB cascade handles: `sessions`, `accounts`, `bodyPhotos`, `verifications` (all have `onDelete: "cascade"`)
      5. Return `{ success: true }`
    - Error: wrap in try/catch, throw `TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ACCOUNT_DELETION_FAILED" })` on failure
  - [x] 2.2 Write co-located tests in `user.test.ts`:
    - Test deleteAccount calls imageStorage.deleteUserDirectory with correct userId
    - Test deleteAccount deletes user from DB
    - Test deleteAccount returns success
    - Test deleteAccount throws on failure

- [x] Task 3: Create AlertDialog component in @acme/ui (AC: #1)
  - [x] 3.1 Create `packages/ui/src/alert-dialog.tsx` using `@gluestack-ui/alert-dialog` (Gluestack v3 copy-paste pattern)
  - [x] 3.2 Export `AlertDialog` component with props:
    - `isOpen: boolean`
    - `onClose: () => void`
    - `onConfirm: () => void`
    - `title: string`
    - `message: string`
    - `confirmLabel?: string` (default: "Delete")
    - `cancelLabel?: string` (default: "Cancel")
    - `variant?: "destructive" | "default"` (default: "default")
    - `isLoading?: boolean` — shows spinner in confirm button when true
  - [x] 3.3 Destructive variant styling: confirm button uses `bg-error` (#D45555) fill, white text
  - [x] 3.4 Default variant: confirm button uses primary black fill
  - [x] 3.5 Cancel button: ghost style, always available, calls `onClose`
  - [x] 3.6 Modal backdrop: dimmed overlay, tap outside does NOT dismiss (prevents accidental cancel during loading)
  - [x] 3.7 Accessibility: `accessibilityRole="alert"` on container, `accessibilityLabel` on buttons
  - [x] 3.8 Export from `packages/ui/src/index.ts`
  - [x] 3.9 Write co-located test `alert-dialog.test.tsx` — test renders title/message, test onConfirm called, test onClose called, test loading state shows spinner

- [x] Task 4: Add "Delete Account" section to profile screen (AC: #1, #4, #5)
  - [x] 4.1 Update `apps/expo/src/app/(auth)/(tabs)/profile.tsx`:
    - Add `deleteAccountMutation` using `useMutation` with `trpc.user.deleteAccount.mutationOptions()`
    - Add `showDeleteDialog` state (`useState<boolean>(false)`)
    - Add "Danger Zone" section below Legal section:
      - Section label: "Danger Zone" (caption, text-error)
      - "Delete Account" button: ghost variant, `text-error` (#D45555), full-width
      - On press: `setShowDeleteDialog(true)`
    - Add `AlertDialog` component:
      - `isOpen={showDeleteDialog}`
      - `onClose={() => setShowDeleteDialog(false)}`
      - `title="Delete Account?"`
      - `message="This will permanently delete your account and all associated data. This action cannot be undone."`
      - `confirmLabel="Delete Account"`
      - `variant="destructive"`
      - `isLoading={deleteAccountMutation.isPending}`
      - `onConfirm` handler:
        1. Call `deleteAccountMutation.mutate()`
    - On mutation success:
      1. Call `authClient.signOut()` to clear local auth state
      2. Call `router.replace("/(public)/sign-in")` to navigate to sign-in
    - On mutation error: show error toast "Account deletion failed. Please try again.", close dialog
  - [x] 4.2 Preserve existing profile layout: body avatar → user info → legal → danger zone → sign out
  - [x] 4.3 Sign out button moves AFTER danger zone (bottom of page)

- [x] Task 5: Write comprehensive tests (AC: all)
  - [x] 5.1 `imageStorage.test.ts` — add tests for deleteUserDirectory (creates dir + files, then verifies removal; verify no error on missing dir)
  - [x] 5.2 `user.test.ts` — add tests for deleteAccount mutation (calls deleteUserDirectory, deletes from DB, returns success, handles errors)
  - [x] 5.3 `alert-dialog.test.tsx` — test renders when open, hidden when closed, onConfirm fires, onClose fires, loading spinner shows, destructive styling applied
  - [x] 5.4 `profile.test.tsx` — add tests: "Delete Account" button visible, opens dialog on press, confirm calls mutation
  - [x] 5.5 All tests use `bun:test` imports, co-located with source files

- [x] Task 6: Typecheck and validation (AC: all)
  - [x] 6.1 Run `pnpm typecheck` — must pass across all packages
  - [x] 6.2 Run `turbo test` — all tests pass, 0 regressions
  - [x] 6.3 Verify AlertDialog renders correctly with destructive variant
  - [x] 6.4 Verify deletion cascade removes all user data
  - [x] 6.5 Verify sign-out and redirect after deletion

## Dev Notes

### Story Context & Purpose

This story implements **FR4** (delete account and all data) and **NFR8** (account deletion removes all user data). It is the **last story in Epic 1** (Project Foundation & User Identity) and completes the user lifecycle: registration (1.3) → consent (1.4) → avatar (1.5) → deletion (1.6).

Account deletion is both an **Apple App Store requirement** and a **GDPR compliance requirement**. All user data — files on disk and records in the database — must be completely and permanently removed.

### Architecture Decision: tRPC Mutation (NOT better-auth deleteUser)

**Why NOT use better-auth's built-in `user.deleteUser`:**
1. Requires password verification or fresh session — adds UX friction
2. `afterDelete` callback doesn't have access to `imageStorage` service (DI pattern)
3. better-auth only deletes its own tables (users, sessions, accounts) — doesn't cascade to app-specific tables like `bodyPhotos`
4. The project's DI architecture uses tRPC context for service injection — better-auth hooks don't participate in this

**Why tRPC mutation is correct:**
1. `protectedProcedure` already validates active session — sufficient auth check
2. Full access to `ctx.imageStorage` for filesystem cleanup
3. Full access to `ctx.db` for Drizzle operations
4. Consistent with established patterns (user.uploadBodyPhoto, user.getBodyPhoto)
5. Client calls it like any other mutation — consistent UX

### Cascading Delete Strategy

**Current state (MVP — Stories 1.1-1.5 done):**

| Table | FK to users | onDelete | Files on disk |
|-------|------------|----------|---------------|
| `sessions` | `userId` | cascade | None |
| `accounts` | `userId` | cascade | None |
| `bodyPhotos` | `userId` | cascade | `{basePath}/{userId}/body/avatar_*.jpg` |
| `verifications` | — | No FK | None (unrelated to user) |

**Delete order:**
1. **Filesystem first:** `imageStorage.deleteUserDirectory(userId)` — removes `{basePath}/{userId}/` recursively. This covers body photos now and will cover garment photos + render results when Epic 2/3 are implemented.
2. **DB second:** `db.delete(users).where(eq(users.id, userId))` — Drizzle cascade automatically deletes: sessions, accounts, bodyPhotos.

**Future-proofing:** The `deleteUserDirectory` approach deletes the entire `{userId}/` directory, which will include `body/`, `garments/`, and `renders/` subdirectories when those are created in Epic 2 and 3. No code change needed when new image types are added — the recursive directory deletion handles everything.

[Source: architecture.md#Authentication & Security — Cascading delete pipeline]
[Source: architecture.md#Data Architecture — Image storage: /data/images/{userId}/]

### AlertDialog Component (New UI Component)

**Why create a new component:**
- UX spec explicitly requires `@gluestack-ui/alert-dialog` for account deletion (the ONLY use case for AlertDialog in the entire app)
- No AlertDialog exists in `packages/ui/` yet — only Button, ThemedText, Spinner, ThemedPressable, Toast
- Gluestack UI v3 is a copy-paste component system — create the component using the headless `@gluestack-ui/alert-dialog` package

**Implementation pattern:**
Follow the same pattern as existing components in `packages/ui/src/`:
- Use `@gluestack-ui/alert-dialog` for headless logic (focus trap, ARIA, overlay)
- Style with NativeWind classes
- Use `tva` for variant styling (destructive vs default)
- Export from `packages/ui/src/index.ts`

**Destructive variant (for this story):**
- Confirm button: `bg-error` (#D45555), white text, 52px height
- Cancel button: ghost style (`text-text-secondary`), 44px height
- Title: ThemedText `title` variant
- Message: ThemedText `body` variant, `text-text-secondary`

**Installation required:**
```bash
pnpm add @gluestack-ui/alert-dialog --filter @acme/ui
```

[Source: ux-design-specification.md#Component Strategy — AlertDialog for account deletion only]
[Source: ux-design-specification.md#Button Hierarchy — Primary/secondary/ghost]

### Profile Screen Layout (Updated)

**Current layout (after Story 1.5):**
1. "Profile" header + subtitle
2. Body avatar section (circular photo or placeholder)
3. "Update/Add Body Photo" pressable row
4. User info card (name + email)
5. Legal section label + Privacy Policy row
6. Sign Out button (mt-auto, bottom of screen)

**New layout (after this story):**
1. "Profile" header + subtitle
2. Body avatar section (circular photo or placeholder)
3. "Update/Add Body Photo" pressable row
4. User info card (name + email)
5. Legal section label + Privacy Policy row
6. **Danger Zone section label (text-error) + "Delete Account" ghost button (text-error)**
7. Sign Out button (bottom of screen)

The "Danger Zone" section goes between Legal and Sign Out. The red color (`text-error` / #D45555) differentiates it from normal actions.

[Source: profile.tsx — current layout, lines 47-151]

### Client-Side Flow

```
User taps "Delete Account" (red ghost button)
  → AlertDialog opens with destructive styling
  → User reads warning: "This will permanently delete..."
  → User taps "Delete Account" (red confirm button)
    → Button shows spinner (mutation.isPending)
    → tRPC mutation: user.deleteAccount
      → Server: deleteUserDirectory → delete user from DB
    → On success:
      → authClient.signOut() — clears local token
      → router.replace("/(public)/sign-in") — navigates to sign-in
    → On error:
      → Error toast: "Account deletion failed. Please try again."
      → Dialog closes, user remains on profile
```

**IMPORTANT:** Call `authClient.signOut()` AFTER the mutation succeeds, not before. The mutation needs the auth token to authenticate the request. Sign out happens client-side after the server confirms deletion.

### Project Structure Notes

**New files to create:**
```
packages/ui/src/alert-dialog.tsx                    # AlertDialog component
packages/ui/src/alert-dialog.test.tsx               # Tests
```

**Existing files to modify:**
```
packages/api/src/services/imageStorage.ts           # Add deleteUserDirectory method
packages/api/src/services/imageStorage.test.ts      # Add deleteUserDirectory tests
packages/api/src/router/user.ts                     # Add deleteAccount procedure
packages/api/src/router/user.test.ts                # Add deleteAccount tests
packages/api/src/trpc.ts                            # Add deleteUserDirectory to ImageStorage interface
packages/ui/src/index.ts                            # Export AlertDialog
packages/ui/package.json                            # Add @gluestack-ui/alert-dialog dependency
apps/expo/src/app/(auth)/(tabs)/profile.tsx         # Add delete account UI
apps/expo/src/app/(auth)/(tabs)/profile.test.tsx    # Add delete account tests
```

**Alignment with architecture document:**
- AlertDialog in `packages/ui/src/` — UI primitives live here
- deleteAccount in `router/user.ts` — user domain router
- imageStorage extension — service layer for filesystem operations
- Tests co-located with source files
- All imports from `bun:test`
- DI pattern for imageStorage (ctx injection)

### Key Dependencies

**This story depends on:**
- Story 1.1 (monorepo foundation) — DONE
- Story 1.2 (design system + Gluestack components) — DONE
- Story 1.3 (auth + session + protectedProcedure) — DONE
- Story 1.5 (imageStorage service + bodyPhotos table + profile screen) — DONE

**Stories that depend on this story:**
- None directly. But Epic 2/3 additions (garments, renders) will benefit from the recursive `deleteUserDirectory` approach — no changes needed when new image types are added.

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**imageStorage tests (DI, temp directory):**
```typescript
// Create temp dir → add files → call deleteUserDirectory → verify dir gone
// Call deleteUserDirectory on missing dir → no error thrown
```

**user router tests (DI, mock DB + mock imageStorage):**
```typescript
// Mock ctx with { db: mockDb, session: { user: { id: "user-1" } }, imageStorage: mockStorage }
// Verify deleteUserDirectory called with "user-1"
// Verify db.delete(users).where called with userId
// Verify returns { success: true }
```

**AlertDialog tests (component rendering):**
```typescript
// Render with isOpen=true → title and message visible
// Render with isOpen=false → nothing rendered
// Press confirm → onConfirm called
// Press cancel → onClose called
// isLoading=true → spinner in confirm button
// variant="destructive" → red confirm button
```

**Profile tests (integration):**
```typescript
// "Delete Account" button renders
// Press "Delete Account" → dialog opens (state change)
// Confirm in dialog → mutation called
```

### Key Pitfalls to Avoid

1. **DO NOT call `authClient.signOut()` BEFORE the delete mutation.** The mutation needs the auth token. Sign out happens on the client AFTER server confirms deletion.

2. **DO NOT use `useState` for loading state.** Use `deleteAccountMutation.isPending` from the tRPC mutation hook.

3. **DO NOT delete individual files — delete the entire user directory.** `rm(userDir, { recursive: true, force: true })` is the correct approach. This future-proofs for garment photos and render results.

4. **DO NOT forget `force: true` in rm options.** Without it, missing directories will throw ENOENT.

5. **DO NOT allow AlertDialog backdrop tap to dismiss during loading.** If `isLoading` is true, backdrop press should be ignored to prevent UX confusion.

6. **DO NOT install `@gluestack-ui/alert-dialog` with npm.** Use `pnpm add @gluestack-ui/alert-dialog --filter @acme/ui`.

7. **DO NOT import from `"zod"`.** Always import from `"zod/v4"`.

8. **DO NOT use `console.log` in server code.** Use `pino` logger.

9. **DO NOT use explicit column name strings in Drizzle queries.** Use the TypeScript field name (e.g., `users.id`).

10. **DO NOT create separate `__tests__/` directory.** Tests are co-located with source.

11. **DO NOT use `throw new Error()` in tRPC routes.** Use `throw new TRPCError()` with specific codes.

12. **DO NOT navigate with `router.push` after deletion.** Use `router.replace` to prevent back-navigation to a deleted account's profile.

### Previous Story Intelligence

**From Story 1.5 (Body Avatar Photo Management):**
- `imageStorage` service at `packages/api/src/services/imageStorage.ts` uses DI factory pattern. Extend it — do NOT create a new service.
- User router at `packages/api/src/router/user.ts` uses `satisfies TRPCRouterRecord` pattern. Add `deleteAccount` to this existing router.
- `ImageStorage` interface at `packages/api/src/trpc.ts` needs `deleteUserDirectory` method added.
- Profile screen at `apps/expo/src/app/(auth)/(tabs)/profile.tsx` already has body avatar, user info, legal, and sign-out sections. Add danger zone between legal and sign out.
- Test preload at `apps/expo/test/setup.ts` has comprehensive mocks — AlertDialog test may need additional Gluestack mock.
- DB `bodyPhotos` table has `onDelete: "cascade"` on userId FK — will auto-delete when user record is deleted.
- Image files stored at `{basePath}/{userId}/body/avatar_*.jpg` — deleteUserDirectory removes parent `{userId}/` dir.

**From Story 1.3 (Auth):**
- `authClient.signOut()` clears local session. Used in profile screen already.
- `router.replace("/(public)/sign-in")` is the pattern for post-signout navigation.
- `protectedProcedure` validates session — use for deleteAccount (user must be authenticated).

**Code review patterns from 1.3, 1.4, 1.5:**
- Use semantic Tailwind tokens (`text-error`, `bg-surface`), not hardcoded hex
- All interactive elements need `accessibilityLabel`, `accessibilityRole`
- Use ThemedPressable / Button from @acme/ui for interactive elements
- Tests must cover all acceptance criteria
- Use `useMutation` from `@tanstack/react-query` for mutations (NOT `api.xxx.useMutation()` directly — the project uses `useMutation` with `trpc.xxx.mutationOptions()`)

### Git Intelligence

**Recent commits (5):**
1. `4df9921` — fix: Story 1.5 code review — missing route, non-null assertion, test coverage, streaming (2C/3H/4M/2L)
2. `0945190` — feat: implement Story 1.5 — Body Avatar Photo Management
3. `a07217b` — docs: add execution threads to parallelization report
4. `2cf62b3` — docs: add sprint parallelization report
5. `e79226a` — feat: implement Story 1.3 — User Registration & Authentication

**Patterns established:**
- Conventional commit messages: `feat:` for story implementation, `fix:` for code review
- Story implementation as single `feat:` commit
- TypeScript strict compliance across all packages
- NativeWind className styling with semantic tokens
- `bunfig.toml` + `test/setup.ts` preload in each package with tests

**Files recently modified (relevant to this story):**
- `packages/api/src/router/user.ts` — Created in 1.5. Adding deleteAccount here.
- `packages/api/src/services/imageStorage.ts` — Created in 1.5. Adding deleteUserDirectory here.
- `packages/api/src/trpc.ts` — Modified in 1.5 for ImageStorage interface. Adding deleteUserDirectory here.
- `apps/expo/src/app/(auth)/(tabs)/profile.tsx` — Modified in 1.3, 1.4, 1.5. Adding danger zone here.

### Latest Tech Information

**@gluestack-ui/alert-dialog (v3):**
- Headless component with ARIA alert dialog semantics
- Provides: `AlertDialog`, `AlertDialogBackdrop`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogBody`, `AlertDialogFooter`, `AlertDialogCloseButton`
- Created via `createAlertDialog()` factory (Gluestack v3 pattern)
- Focus trap: traps focus within dialog when open
- Overlay: renders backdrop behind content
- Requires `@gluestack-ui/overlay` and `@legend-app/motion` peer deps (already in project via other Gluestack components)

**Node.js `fs.rm` with `{ recursive: true, force: true }`:**
- `recursive: true` — removes directory and all contents
- `force: true` — suppresses ENOENT errors (no error if path doesn't exist)
- Available since Node.js 14+ and fully supported in Bun runtime

**Drizzle ORM cascade behavior:**
- `onDelete: "cascade"` on FK means deleting the parent (users) automatically deletes all child records (sessions, accounts, bodyPhotos)
- This is a database-level cascade — Drizzle sends a single DELETE to PostgreSQL and the DB handles the rest
- No need to manually delete from sessions, accounts, or bodyPhotos tables

### References

- [Source: epics.md#Story 1.6] — Story definition and all 5 acceptance criteria
- [Source: prd.md#FR4] — Delete account and all associated data
- [Source: prd.md#NFR8] — Account deletion removes all user data
- [Source: architecture.md#Authentication & Security] — Cascading delete pipeline
- [Source: architecture.md#Data Architecture] — Image storage: /data/images/{userId}/
- [Source: architecture.md#Naming Patterns] — camelCase TS, snake_case SQL
- [Source: architecture.md#Structure Patterns] — Co-located tests, bun test, DI pattern
- [Source: ux-design-specification.md#Component Strategy] — AlertDialog for account deletion only
- [Source: ux-design-specification.md#Button Hierarchy] — Primary/secondary/ghost, 52px height
- [Source: ux-design-specification.md#Color System] — error (#D45555)
- [Source: ux-design-specification.md#Accessibility Strategy] — VoiceOver, accessibilityLabel, accessibilityRole
- [Source: project-context.md#Drizzle ORM Patterns] — casing: snake_case, onDelete cascade
- [Source: project-context.md#Testing Rules] — bun:test, co-located, DI over mock.module
- [Source: project-context.md#tRPC Patterns] — protectedProcedure, TRPCError
- [Source: 1-5-body-avatar-photo-management.md] — imageStorage service, user router, profile screen layout, DI patterns
- [Source: 1-3-user-registration-and-authentication.md] — authClient.signOut(), router.replace for post-auth navigation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

### Completion Notes List

- **Task 1:** Added `deleteUserDirectory(userId)` method to `createImageStorage` — recursively removes `{basePath}/{userId}/` with `rm(path, { recursive: true, force: true })`, logs via pino. Updated `ImageStorage` interface in `trpc.ts`. Added 2 tests: directory removal and graceful missing-dir handling.
- **Task 2:** Added `deleteAccount` mutation to `userRouter` — `protectedProcedure` that deletes filesystem first via `imageStorage.deleteUserDirectory(userId)`, then DB via `db.delete(users).where(eq(users.id, userId))`. Cascade handles sessions/accounts/bodyPhotos. Wrapped in try/catch throwing `ACCOUNT_DELETION_FAILED`. Added 5 tests: DI call, DB delete, success return, error handling, auth guard.
- **Task 3:** Created `AlertDialog` component in `@acme/ui` — uses React Native `Modal` with `tva` variants (destructive/default/cancel). Destructive: `bg-error` (#D45555) white text h-52px. Cancel: ghost style h-44px. Dimmed overlay, `accessibilityRole="alert"`, `accessibilityLabel` on buttons. Loading state shows spinner in confirm button. Exported from `index.ts` and `package.json`. Added 9 tva+export tests.
- **Task 4:** Updated profile screen — added `deleteAccountMutation` via `useMutation` with `trpc.user.deleteAccount.mutationOptions()`. Added "Danger Zone" section (red caption + ghost button) between Legal and Sign Out. AlertDialog with destructive variant, loading state from `mutation.isPending`. On success: `authClient.signOut()` then `router.replace("/(public)/sign-in")`. On error: toast + close dialog. Added 4 profile tests.
- **Task 5:** All tests written co-located with source, using `bun:test` imports. Test setup preloads updated for Modal mock (both ui and expo packages) and AlertDialog mock (expo setup).
- **Task 6:** `pnpm typecheck` — 13/13 packages pass. `turbo test` — 134 tests (post-review: 49 UI + 59 Expo + 26 API), 0 failures, 0 regressions.

### Change Log

- 2026-02-16: Implemented Story 1.6 — Account Deletion (all 6 tasks, all 5 ACs satisfied)
- 2026-02-16: Code review fixes (3H/3M/1L fixed, 1L accepted) — removed dead @gluestack-ui/alert-dialog dep, added 9 rendering tests to AlertDialog, fixed Delete Account button text color (ThemedPressable+ThemedText replacing Button), added AlertDialog confirm/destructive tests to profile, removed unused VariantProps import, added backdrop dismiss when not loading, added pnpm-lock.yaml to File List

### File List

**New files:**
- `packages/ui/src/alert-dialog.tsx` — AlertDialog component with destructive/default variants
- `packages/ui/src/alert-dialog.test.tsx` — AlertDialog tva style tests + export smoke test

**Modified files:**
- `packages/api/src/services/imageStorage.ts` — Added `deleteUserDirectory` method
- `packages/api/src/services/imageStorage.test.ts` — Added 2 deleteUserDirectory tests
- `packages/api/src/router/user.ts` — Added `deleteAccount` mutation, imported `users` schema
- `packages/api/src/router/user.test.ts` — Added 5 deleteAccount tests, added `afterEach` import, added `deleteUserDirectory` to mock
- `packages/api/src/trpc.ts` — Added `deleteUserDirectory` to `ImageStorage` interface
- `packages/ui/src/index.ts` — Exported AlertDialog, alertDialogButtonStyle, alertDialogButtonTextStyle
- `packages/ui/package.json` — Added `./alert-dialog` export, added `react-dom` devDependency for test rendering (removed dead `@gluestack-ui/alert-dialog` dep during code review)
- `packages/ui/test/setup.ts` — Added `Modal` to react-native mock
- `apps/expo/src/app/(auth)/(tabs)/profile.tsx` — Added Danger Zone section, AlertDialog, deleteAccount mutation, useState import
- `apps/expo/src/app/(auth)/(tabs)/profile.test.tsx` — Added 4 delete account UI tests
- `apps/expo/test/setup.ts` — Added `Modal` to react-native mock, added `AlertDialog` to @acme/ui mock
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 1-6-account-deletion status to review
- `pnpm-lock.yaml` — Updated from dependency changes (react-dom devDep added, @gluestack-ui/alert-dialog removed)
