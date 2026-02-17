# Merge Audit Report — `feat/1-5-body-avatar` → `main`

**Commit:** `1510609` (merge: resolve 12 conflicts from feat/1-5-body-avatar into main)
**Scope:** 140 files changed, 22,762 insertions, 458 deletions
**Date:** 2026-02-17
**Auditors:** 5 parallel agents (Security, Database, API/Architecture, Frontend, Tests)

---

## Executive Summary

The merge introduces Epics 1.5–3.5: body avatar photos, garment management, wardrobe browsing, stock garments, AI try-on render pipeline, render results, feedback/refunds, and category validation. Architecture is generally solid — service layer abstraction, auth gates, webhook signature verification, and test coverage are all well-implemented.

**However, 3 critical business logic bugs were independently confirmed by 3+ agents each:**

1. **The credit system is decorative** — renders are never gated by credit balance
2. **Refunds are cosmetic + exploitable** — credits table never updated, race condition enables abuse
3. **Path traversal protection is inconsistent** — all write operations bypass `safePath()`

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 5 |
| MEDIUM | 16 |
| LOW | 15 |
| **Total** | **39** |

---

## CRITICAL — Must Fix Before Release

### C-1: Credit system does not gate render submissions
**Confirmed by:** security-auditor, db-auditor, api-auditor (3/5 agents)
**Files:** `packages/api/src/router/tryon.ts:28-168`, `packages/api/src/trpc.ts:168-176`

The `requestRender` procedure uses `renderProcedure` which checks only auth + rate limits. There is **no credit balance check** before submitting an AI render job. `creditService.hasCreditsRemaining()` exists but is never called. The `INSUFFICIENT_CREDITS` error code from CLAUDE.md is never thrown anywhere in the codebase.

**Impact:** Any authenticated user can submit unlimited AI render jobs (which cost real money via fal.ai/Google VTO). The entire monetization model is bypassed.

**Fix:** Add credit check at the start of `requestRender`:
```typescript
const hasCredits = await creditService.hasCreditsRemaining(userId);
if (!hasCredits) throw new TRPCError({ code: "FORBIDDEN", message: "INSUFFICIENT_CREDITS" });
```

---

### C-2: Refund logic is broken — credits table never updated + race condition
**Confirmed by:** security-auditor, db-auditor, api-auditor (3/5 agents)
**Files:** `packages/api/src/router/tryon.ts:302-324`

The thumbs-down refund flow has two independent bugs:

1. **Credits never restored:** Sets `creditConsumed: false` on the render record but never calls `creditService.refundCredit()` — the `credits.totalConsumed` counter is unchanged. Refunds are cosmetic only.
2. **Race condition:** The refund count check and credit update are not transactional. Concurrent thumbs-down requests for different renders can both pass the `MAX_REFUNDS_PER_MONTH` check, doubling the refund count.

**Impact:** Either refunds silently fail (credits never restored) or can be exploited via concurrent requests to bypass the monthly cap.

**Fix:** Wrap in a transaction with `SELECT ... FOR UPDATE`, call `creditService.refundCredit(userId)`, and ensure the `credits` table and `creditConsumed` flag are updated atomically.

---

### C-3: All image write operations bypass `safePath()` validation
**Confirmed by:** security-auditor, api-auditor (2/5 agents)
**Files:** `packages/api/src/services/imageStorage.ts:30-176`

Five methods construct paths via `join(basePath, ...)` without `safePath()` validation:
- `saveBodyPhoto` (line 42)
- `deleteUserDirectory` (line 72) — performs `rm -rf`
- `saveGarmentPhoto` (line 93)
- `saveCutoutPhoto` (line 118)
- `saveRenderResult` (line 164)

Meanwhile `deleteBodyPhoto`, `getAbsolutePath`, and `streamFile` all correctly use `safePath()`. The inconsistency is a defense-in-depth gap. `deleteUserDirectory` is especially dangerous as it does `rm(userDir, { recursive: true, force: true })`.

**Impact:** If any ID input (userId, garmentId, renderId) were ever tainted with `../`, files could be written or directories deleted outside the storage base.

**Fix:** Route all path construction through `safePath()`. Create a shared helper combining `join` + `safePath` validation.

---

## HIGH

### H-1: Missing index on `tryOnRenders.jobId` (webhook lookup)
**Source:** db-auditor
**File:** `packages/db/src/schema.ts:130-155`

The fal.ai webhook does `WHERE job_id = ?` on every callback. No index exists — every webhook performs a full table scan.

**Fix:** Add `index("try_on_renders_job_id_idx").on(table.jobId)` to the table definition.

---

### H-2: GoogleVTO in-memory result store is unbounded
**Source:** api-auditor, security-auditor
**File:** `packages/api/src/services/providers/googleVTO.ts:97-106`

Results stored in a `Map` with 5-minute `setTimeout` cleanup. No size cap. Under load, server OOMs. In horizontal scaling, results are lost across instances.

**Fix:** Save results to disk via `imageStorage.saveRenderResult()` instead of holding in memory. Add `MAX_RESULTS_IN_MEMORY` cap as safety valve.

---

### H-3: Missing FK indexes on hot query paths
**Source:** db-auditor
**File:** `packages/db/src/schema.ts`

No indexes on `garments.userId`, `tryOnRenders.userId`, `tryOnRenders.garmentId`, `renderFeedback.userId`. All list/get queries filter by `userId` — sequential scan on every request.

**Fix:** Add indexes on all FK columns used in WHERE clauses.

---

### H-4: Garment delete is non-atomic (FS before DB)
**Source:** db-auditor, api-auditor
**File:** `packages/api/src/router/garment.ts:222-239`

Deletes FS files first, then DB record. If DB delete fails, files are gone but garment record persists as orphan.

**Fix:** Reverse order — delete DB record first (with `RETURNING` to confirm), then clean up FS. DB is source of truth; FS cleanup is best-effort.

---

### H-5: `getEphemeralStatus` hardcodes `hasUsedFreeRender: false`
**Source:** api-auditor
**File:** `packages/api/src/router/auth.ts:21`

TODO says "Enable when renders table exists (Story 3.2)" but `tryOnRenders` table now exists. Anonymous users are always told they haven't used their free render.

**Fix:** Query `tryOnRenders` for the user's actual render count.

---

## MEDIUM

### Security

| # | Finding | File | Fix |
|---|---------|------|-----|
| M-1 | Rate limiter has no key eviction — slow memory leak | `rateLimit.ts` | Delete empty keys after filtering; add periodic sweep |
| M-2 | Webhook body read has no size limit — memory exhaustion | `fal.ts:111-115` | Add 1MB body size limit |
| M-3 | Webhook image download has no size limit | `fal.ts:211-212` | Check Content-Length before download; stream to disk |
| M-4 | JWKS cache has no forced refresh on signature failure | `fal.ts:34-46` | On verify failure, force-refresh cache once and retry |
| M-5 | Background removal output URL not validated (SSRF) | `backgroundRemoval.ts:70` | Validate against Replicate CDN domain |
| M-6 | `grantInitialCredits` callable by any authenticated user | `subscription.ts:20-27` | Add guard: return early if credits row exists |

### Database

| # | Finding | File | Fix |
|---|---------|------|-----|
| M-7 | Inconsistent timestamp types (`withTimezone` vs plain) | `schema.ts` (multiple) | Standardize all to `{ withTimezone: true }` |
| M-8 | `users.id` has no `$defaultFn(() => createId())` safety net | `schema.ts:5-6` | Add `$defaultFn` as safety fallback |
| M-9 | Fire-and-forget background removal — stuck "pending" forever | `garment.ts:131-161` | Add scheduled cleanup for stuck records |

### Frontend

| # | Finding | File | Fix |
|---|---------|------|-----|
| M-10 | Deprecated `MediaTypeOptions` API in onboarding | `StepPickGarment.tsx`, `StepYourPhoto.tsx` | Replace with `mediaTypes: ["images"]` |
| M-11 | `data-testid` instead of RN `testID` | `SkeletonGrid.tsx:47,54` | Replace with `testID` prop |
| M-12 | `router.push` with `as never` type bypass | `index.tsx:116` | Use typed `{ pathname, params }` form |
| M-13 | Hardcoded hex colors instead of theme tokens | Multiple components | Replace with NativeWind theme classes |
| M-14 | String concatenation for className instead of `cn()` | `StepPickGarment.tsx:63` | Use `cn()` from `@acme/ui` |
| M-15 | Upload queue has no max size bound | `uploadQueue.ts:43-47` | Add `MAX_QUEUE_SIZE` constant |

### Tests

| # | Finding | File | Fix |
|---|---------|------|-----|
| M-16 | Coverage gaps: no tests for `base-url.ts`, `session-store.ts`, `auth.ts` | (missing files) | Add co-located test files |

---

## LOW

| # | Finding | Source | File |
|---|---------|--------|------|
| L-1 | `$onUpdate` vs `$onUpdateFn` naming inconsistency | db | `schema.ts` |
| L-2 | Unnamed unique constraint on `bodyPhotos.userId` | db | `schema.ts:68` |
| L-3 | Schema tests are shallow — no constraint/cascade testing | db | `schema.test.ts` |
| L-4 | `is5xxError` uses fragile regex on error message string | api | `tryon.ts:10-19` |
| L-5 | Redundant type assertion on provider name (`as` cast) | api | `tryon.ts:99` |
| L-6 | `imageId` format not validated before DB query | security | `images.ts:73` |
| L-7 | Upload queue stores file URIs in unencrypted MMKV | security | `uploadQueue.ts:39-41` |
| L-8 | Duplicate `CATEGORIES` constant in `add.tsx` | frontend | `add.tsx:29` vs `constants/categories.ts` |
| L-9 | Auth cookie header IIFE duplicated in 3 components | frontend | `GarmentCard`, `GarmentDetailSheet`, `render/[id]` |
| L-10 | `setConsented(true)` called during render, not in useEffect | frontend | `_layout.tsx:47-49` |
| L-11 | `StepSeeTheMagic` mutation fires twice in Strict Mode | frontend | `StepSeeTheMagic.tsx:89-93` |
| L-12 | `console.warn` in production client code | frontend | `_layout.tsx:35` |
| L-13 | Empty `afterEach` blocks (comment but no `mock.restore()`) | tests | `profile.test.tsx`, `BodyPhotoManager.test.tsx` |
| L-14 | `fal.test.ts` mutates `globalThis.fetch` instead of `spyOn` | tests | `fal.test.ts:122-147` |
| L-15 | Mock mutation on `libsodium-wrappers` instead of `spyOn` | tests | `fal.test.ts:185-205` |

---

## Verified Correct (Positive Findings)

The following were explicitly verified as compliant across all 5 auditors:

- **Zod v4 imports** — correctly using `"zod/v4"` everywhere, zero `"zod"` imports
- **cuid2 IDs** — all entity tables use `t.text().$defaultFn(() => createId())`, no auto-increment
- **Drizzle casing** — `casing: "snake_case"` in both client and config, no explicit column names
- **Architecture boundaries** — routers never call external APIs directly, always through services
- **TryOnProvider abstraction** — AI inference exclusively through provider interface
- **TRPCError with business codes** — zero `throw new Error()` in routers
- **`satisfies TRPCRouterRecord`** — all 5 routers use the pattern
- **Auth-gated images** — ownership checks on all image/garment/render access
- **Cascade deletes** — all FKs to `users.id` have `onDelete: "cascade"`, account deletion covers all tables
- **Credit consumed only on success** — webhook correctly sets `creditConsumed: true` only for successful renders
- **pino logging** — zero `console.log` in server code
- **No `process.env` outside `env.ts`** — ESLint rule enforced
- **Webhook signature verification** — Ed25519 + JWKS, well-implemented
- **SSRF protection** — `.fal.media` domain allowlist on webhook image downloads
- **Image magic byte validation** — content verified, not just MIME header
- **Idempotent webhook processing** — duplicate delivery protection
- **All test imports from `"bun:test"`** — zero vitest/jest imports
- **Excellent DI patterns** — no first-party `mock.module` abuse
- **Co-located tests** — all test files next to source
- **No `useState` for loading/error** — TanStack Query states used correctly
- **Components in domain folders** — proper `garment/`, `tryon/`, `profile/`, `common/` organization
- **`import type` enforced** — consistent separate-type-imports
- **No Bun APIs in client code** — `bun:test` only in test files
- **`protectedProcedure`** used for all auth-required endpoints
- **superjson transformer** configured

---

## Recommended Fix Priority

### Sprint 0 — Before any user testing
1. **C-1:** Wire credit checks into render flow
2. **C-2:** Fix refund to update credits table + add transaction
3. **C-3:** Apply `safePath()` to all imageStorage write/delete operations

### Sprint 1 — Before production
4. **H-1:** Add `jobId` index on `tryOnRenders`
5. **H-2:** Replace GoogleVTO memory store with disk storage
6. **H-3:** Add FK indexes on `userId`, `garmentId` columns
7. **H-4:** Reverse garment delete order (DB first, then FS)
8. **H-5:** Implement actual `hasUsedFreeRender` check
9. **M-2 + M-3:** Add size limits on webhook body + image download
10. **M-5:** Validate background removal output URL domain

### Sprint 2 — Quality polish
11. **M-7:** Standardize timestamps to `withTimezone: true`
12. **M-10 – M-12:** Fix deprecated API, testID, typed routes
13. **M-1:** Add rate limiter key eviction
14. **M-4:** JWKS cache refresh on signature failure
15. **M-9:** Add stuck "pending" background removal cleanup
16. All remaining MEDIUM and LOW findings
