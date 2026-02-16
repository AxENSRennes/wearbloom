# Full Branch Audit: `feat/1-5-body-avatar`

**24 commits, 185 files changed, ~22K lines added**

---

## 1. TypeScript & Lint

### Typecheck: PASS (all 13 tasks succeeded)

### Lint: FAIL (5 of 11 packages)

| Package | Errors | Key Issues |
|---------|--------|------------|
| `@acme/expo` | 73 | 54 `react-hooks/refs` violations, 8 test files not in tsconfig, 3 `consistent-type-imports`, 2 `no-floating-promises` |
| `@acme/api` | 6 | `no-unsafe-member-access` on error `.code`/`.constraint` access in bodyAvatar router/service |
| `@acme/auth` | 5 | `no-floating-promises` in `test/setup.ts` |
| `@acme/server` | 3 | `no-unsafe-assignment`/`no-unsafe-call` in `index.ts` |
| `@acme/ui` | 1 | `no-unsafe-assignment` in `AvatarPreview.tsx` |

**Top priority**: The 54 `react-hooks/refs` errors across 8 hooks/components (passing refs into mutation/query option callbacks) and the 8 test files excluded from the Expo tsconfig.

---

## 2. Security Audit

| ID | Severity | Description | File |
|----|----------|-------------|------|
| S10-1 | **HIGH** | No rate limiting on any endpoint (uploads, renders, auth) | `server/src/index.ts` |
| S8-1 | **HIGH** | No CORS headers on HTTP server | `server/src/index.ts` |
| SL-3 | **HIGH** | No path traversal guard in `imageStorage.streamFile()` | `api/services/imageStorage.ts:168` |
| S5-1 | MEDIUM | No magic byte validation on uploads (client-declared MIME only) | `api/router/garment.ts:50`, `user.ts:36` |
| S3-1 | MEDIUM | `getSession` returns raw session token to client | `api/router/auth.ts:6` |
| S10-2 | MEDIUM | Webhook image download URL not domain-validated (SSRF) | `server/webhooks/fal.ts:207` |
| S7-3 | LOW | Missing `X-Content-Type-Options: nosniff` on image responses | `server/routes/images.ts:163` |
| S7-1 | LOW | `TRPCError` with `cause: error` may leak stack traces | `api/router/garment.ts:238` |
| S9-1 | LOW | `submitFeedback.category` unbounded string length | `api/router/tryon.ts:237` |

**What passed cleanly**: Auth gating on all image routes, webhook signature verification (Ed25519 + timestamp), all sensitive procedures use `protectedProcedure` with ownership checks, credit deduction only on success, no SQL injection, proper env validation.

---

## 3. Database Schema & Architecture

| ID | Severity | Description |
|----|----------|-------------|
| S-3 | MEDIUM | Missing index on `tryOnRenders.jobId` -- webhook lookups do full table scan |
| S-3 | MEDIUM | Missing composite index on `garments(userId, createdAt)` for list queries |
| A-5 | MEDIUM | `garment.list`/`getGarment` leak internal file paths (`imagePath`, `cutoutPath`) to client |
| SL-6 | MEDIUM | GoogleVTO provider stores results in unbounded in-memory `Map` |

**What passed cleanly**: All FKs use `onDelete: cascade`, full deletion cascade verified (user -> all children), `casing: snake_case` correctly configured, all enums properly defined, all architecture boundaries respected (Expo never touches DB, routers never call APIs directly, AI inference abstracted behind TryOnProvider, images always auth-gated, credits never deducted on failure).

---

## 4. Test Quality & Coverage

| Finding | Severity | Details |
|---------|----------|--------|
| Missing test: `saveRenderResult()` | MEDIUM | `imageStorage.test.ts` covers all save methods except this one |
| Duplicate test | MEDIUM | `garment.test.ts` -- "rejects unauthenticated requests" appears twice identically |
| Missing test: `headers.ts` | LOW | `nodeHeadersToHeaders` utility has no tests |
| Weak assertions | LOW | FeedbackButton SSR tests assert `"44"` and `"32"` as standalone strings |

**What passed cleanly**: 100% test co-location, zero placeholder tests, correct `mock.module()` usage (only third-party), excellent DI patterns for first-party modules, comprehensive edge case coverage (error paths, timeouts, idempotency, credit policy), proper spy cleanup.

---

## 5. Import Patterns & CLAUDE.md Rules

| Category | Violations | Severity |
|----------|-----------|----------|
| Non-null assertions (`!.`) | **15** in 2 test files | MEDIUM |
| Zod v4 imports | 0 | -- |
| `process.env` outside env.ts | 0 (on branch) | -- |
| `console.log` in server code | 0 | -- |
| Test imports (bun:test) | 0 | -- |
| `useState` for loading/error | 0 | -- |

---

## 6. React Native / UI Code

| Finding | Severity | File |
|---------|----------|------|
| `FeedbackButton` uses 100% inline styles, 0 NativeWind | MEDIUM | `components/tryon/FeedbackButton.tsx:175-296` |
| `RenderLoadingAnimation` inline styles for static views | MEDIUM | `components/tryon/RenderLoadingAnimation.tsx` |
| Thumbs-up/down buttons lack `accessibilityLabel`/`accessibilityRole` | MEDIUM | `FeedbackButton.tsx:238-264` |
| Category picker buttons lack accessibility labels | MEDIUM | `FeedbackButton.tsx:202-223` |
| 3 utility files use kebab-case (CLAUDE.md says camelCase) | LOW | `image-compressor.ts`, `upload-queue.ts`, `query-persister.ts` |
| `useTryOnRender.ts` appears to be dead code | LOW | `hooks/useTryOnRender.ts` |
| `body-photo` route not registered in Stack | LOW | `(auth)/_layout.tsx` |

**What passed cleanly**: Component organization by domain, no `useState` for server state, no global stores, `LegendList` for main grid, `expo-image` everywhere, `SafeAreaView` on all screens, `useReducedMotion` in all animated components, no `AsyncStorage`, image compression before upload.

---

## Priority Fix List

**Must fix (HIGH):**
1. Add path traversal guard in `imageStorage.streamFile()`
2. Add rate limiting (at minimum on render requests and uploads)
3. Add CORS headers or explicit origin restriction

**Should fix (MEDIUM):**
4. Fix 54 `react-hooks/refs` lint errors (restructure ref access in callbacks)
5. Add Expo test files to tsconfig
6. Add `X-Content-Type-Options: nosniff` + magic byte validation on uploads
7. Add indexes on `tryOnRenders.jobId` and `garments(userId, createdAt)`
8. Stop leaking internal file paths in `garment.list`/`getGarment` responses
9. Add accessibility labels to FeedbackButton interactive elements
10. Convert FeedbackButton/RenderLoadingAnimation to NativeWind classes
11. Remove 15 non-null assertions in test files
12. Filter `getSession` response to exclude raw token

**Nice to fix (LOW):**
13. Missing tests (saveRenderResult, headers.ts)
14. Remove duplicate test in garment.test.ts
15. Clean up dead code (`useTryOnRender.ts`)
16. Rename kebab-case utility files to camelCase
