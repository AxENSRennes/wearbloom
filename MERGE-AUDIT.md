# Merge Audit: `main` (Epic 5) → `feat/1-5-body-avatar`

**Commit:** `11480f2` — 82 files changed, ~4,067 insertions, ~298 deletions
**Date:** 2026-02-16
**Scope:** Epic 5 (ephemeral tokens, onboarding flow, anonymous user support)

---

## Build Status

| Check | Status | Details |
|-------|--------|---------|
| Typecheck | PASS | 13/13 packages |
| Lint | PASS | 11/11 packages |
| Tests | **FAIL** | 2 failures in `@acme/expo` (595/597 pass) |

---

## Test Failures

### 1. AuthLayout expects Slot but component now uses Stack — HIGH

- **File:** `apps/expo/src/app/(auth)/_layout.test.tsx:25`
- **Assertion:** `expect(html).toContain("mock-Slot")`
- **Actual:** Renders `<Stack>` with screens `(tabs)`, `body-photo`, `render/[id]`
- **Cause:** Layout was refactored from `<Slot />` to `<Stack>` with explicit screen registrations; test was not updated
- **Fix:** Update test expectation to match Stack-based rendering

### 2. Sign-up skip button missing accessibilityHint — MEDIUM

- **File:** `apps/expo/src/app/(public)/sign-up.test.tsx:103`
- **Assertion:** `expect(html).toContain("Returns to onboarding to try more combinations")`
- **Actual:** Button renders with `label="Skip for now" variant="ghost"` but no `accessibilityHint`
- **Cause:** `sign-up.tsx:247` never passes `accessibilityHint` to the Button, despite the test expecting it
- **Fix:** Add `accessibilityHint` prop to the skip button in `sign-up.tsx`

---

## Conflict Markers

None. All 4 grep hits were false positives (YAML/comment section dividers using `===`).

---

## Code Quality Issues

### HIGH

| # | Issue | File | Lines |
|---|-------|------|-------|
| H-1 | `useState` for loading state instead of TanStack Query | `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx` | 43 |
| H-2 | Silent catch-all on `authClient.signIn.anonymous()` — render proceeds even if auth fails | `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx` | 124–128 |
| H-3 | Generic `throw new Error()` in service layer (should be typed at router boundary) | `packages/api/src/services/imageStorage.ts`, `tryOnProvider.ts`, `googleVTO.ts`, `falNanoBanana.ts` | Various |

### MEDIUM

| # | Issue | File | Lines |
|---|-------|------|-------|
| M-1 | `ephemeralProcedure` defined/exported but never used anywhere | `packages/api/src/trpc.ts` | 201 |
| M-2 | Silent permission denial — no user feedback when camera/gallery access denied | `apps/expo/src/components/onboarding/StepYourPhoto.tsx`, `StepPickGarment.tsx` | 34–35, 92–93 |
| M-3 | `AsyncStorage` for onboarding state (not sensitive, but inconsistent with secure storage pattern) | `apps/expo/src/utils/onboardingState.ts` | 1–12 |
| M-4 | `verifications` table missing `.notNull().defaultNow()` on timestamps (may be better-auth managed) | `packages/db/src/schema.ts` | 179–186 |
| M-5 | Mock service placeholder — no real tRPC integration for renders during onboarding | `apps/expo/src/services/mockRenderService.ts` | Entire file |
| M-6 | ForwardRef key warnings (12+ instances) in test output from `LegendList` internal rendering | Test output only | N/A |

### LOW

| # | Issue | File | Lines |
|---|-------|------|-------|
| L-1 | 12 test files missing `afterEach(() => { mock.restore() })` cleanup | Multiple (see appendix) | — |
| L-2 | String-based source assertions in onboarding tests (fragile) | `apps/expo/src/app/(onboarding)/index.test.tsx` | 14–24 |
| L-3 | `text-white/70` opacity may fail WCAG AA contrast | `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx` | 252 |
| L-4 | TODOs for Epic-2/Epic-3 integration (expected, tracked) | Multiple files | — |

---

## Positive Findings

- No architecture boundary violations — Expo never touches DB directly
- All Zod imports use `"zod/v4"` correctly
- All test imports use `"bun:test"` — no vitest/jest imports
- All tests co-located next to source files
- pino logging used consistently on server (no `console.log`)
- Auth ownership checks properly enforced on image endpoints
- Rate limiting correctly applied to renders, uploads, and auth
- Path traversal guard present in image storage
- Webhook signature verification with JWKS in place
- Cascade deletes properly configured on all FK relationships
- cuid2 IDs used for all entities
- NativeWind v4 patterns correct (no v5 APIs)
- Gluestack v3 components properly wrapped with ForwardRef and display names
- Button component correctly forwards new `accessibilityHint` prop

---

## Recommended Actions

### Immediate (before next commit)

1. Fix the 2 failing tests — update `_layout.test.tsx` to expect `mock-Stack`, add `accessibilityHint` to sign-up skip button

### Before merging to main

2. Resolve H-1: Replace `useState` loading state with TanStack Query mutation in `StepSeeTheMagic.tsx`
3. Resolve H-2: Add proper error handling for anonymous sign-in failure — don't proceed with render on auth failure
4. Resolve H-3: Wrap service-layer generic errors in `TRPCError` at router boundary

### Backlog

5. Wire up or remove `ephemeralProcedure` (M-1)
6. Add user feedback on permission denial in image pickers (M-2)
7. Add `afterEach` cleanup to 12 test files (L-1)

---

## Appendix: Test Files Missing `afterEach` Cleanup

1. `apps/expo/src/components/common/EmptyState.test.tsx`
2. `apps/expo/src/components/garment/CategoryPills.test.tsx`
3. `apps/expo/src/components/garment/GarmentCard.test.tsx`
4. `apps/expo/src/utils/uploadQueue.test.ts`
5. `apps/server/src/routes/images.test.ts`
6. `packages/api/src/router/auth.test.ts`
7. `packages/api/src/services/providers/falFashn.test.ts`
8. `packages/api/src/services/providers/falNanoBanana.test.ts`
9. `packages/api/src/services/providers/googleVTO.test.ts`
10. `packages/api/src/trpc.test.ts`
11. `packages/auth/src/index.test.ts`
12. `packages/ui/src/action-sheet.test.tsx`
