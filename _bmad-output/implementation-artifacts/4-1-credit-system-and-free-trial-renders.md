# Story 4.1: Credit System & Free Trial Renders

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to receive free try-on renders to experience the app's value,
So that I can decide if a subscription is worth it based on real results.

## Acceptance Criteria

1. **Given** a brand new user without an account **When** they complete their first try-on during onboarding **Then** the render is free and does not require account creation (FR17) **And** an ephemeral token authorizes this render server-side

2. **Given** a user creates an account **When** account creation completes **Then** additional free render credits are granted (exact count is a server-side configuration) (FR17) **And** the credits are stored in the credits table

3. **Given** a free user with credits remaining **When** they request a try-on render **Then** one credit is consumed on successful render completion (FR18) **And** no credit is consumed on technical failure or user-reported bad quality

4. **Given** a subscriber **When** they request a try-on render **Then** no credit is consumed and no credit tracking occurs (FR18) **And** renders are unlimited

5. **Given** the CreditCounter component **When** a free user has credits remaining **Then** the count is displayed as subtle text (not a prominent warning) (FR21)

6. **Given** the CreditCounter component **When** a subscriber is active (trial or paid) **Then** the counter is completely hidden — no counters, no monetization UI visible

7. **Given** the credits table in Drizzle **When** created **Then** it includes: id (cuid2), user_id (FK), total_granted, total_consumed, created_at, updated_at

8. **Given** the free credit count configuration **When** managed server-side **Then** it can be changed without an app update (environment variable or database config)

## Tasks / Subtasks

- [x] Task 1: Add credits table to Drizzle schema (AC: #7)
  - [x] 1.1 Add credits table to `packages/db/src/schema.ts` with fields: `id` (text, cuid2 PK), `userId` (text, FK to users, onDelete cascade, unique — one credit row per user), `totalGranted` (integer, default 0), `totalConsumed` (integer, default 0), `createdAt` (timestamp, defaultNow), `updatedAt` (timestamp, defaultNow with onUpdate)
  - [x] 1.2 Export the `credits` table from schema — do NOT use explicit column name strings (let Drizzle `casing: "snake_case"` handle mapping)
  - [x] 1.3 Run `pnpm db:push` to sync schema to local PostgreSQL
  - [x] 1.4 Verify with Drizzle Studio (`pnpm db:studio`) that the `credits` table exists with correct snake_case columns

- [x] Task 2: Add FREE_CREDITS_COUNT to server env config (AC: #8)
  - [x] 2.1 Add `FREE_CREDITS_COUNT` to `apps/server/src/env.ts` Zod schema — `z.coerce.number().int().min(0).default(3)` (import z from `"zod/v4"`)
  - [x] 2.2 Add `FREE_CREDITS_COUNT=3` to `.env.example`
  - [x] 2.3 Add `FREE_CREDITS_COUNT=3` to local `.env` file (if exists)

- [x] Task 3: Create credit service with dependency injection (AC: #2, #3, #4, #8)
  - [x] 3.1 Create `packages/api/src/services/creditService.ts` exporting a factory `createCreditService({ db })` that returns an object with methods
  - [x] 3.2 Method `grantFreeCredits(userId: string, count: number): Promise<void>` — upsert credits row: if row exists and totalGranted === 0 (never granted before), set totalGranted to count; if already granted, no-op (idempotent). Use Drizzle `insert...onConflictDoNothing` or check-then-insert pattern
  - [x] 3.3 Method `consumeCredit(userId: string): Promise<{ success: boolean; remaining: number }>` — atomically increment totalConsumed by 1 WHERE totalConsumed < totalGranted. Return success=false if no credits remaining. Use `sql` tagged template for atomic update: `SET total_consumed = total_consumed + 1 WHERE total_consumed < total_granted`
  - [x] 3.4 Method `refundCredit(userId: string): Promise<void>` — decrement totalConsumed by 1 (for bad quality feedback refund). Guard against going below 0
  - [x] 3.5 Method `getCreditBalance(userId: string): Promise<{ totalGranted: number; totalConsumed: number; remaining: number }>` — query credits row, return balance (remaining = totalGranted - totalConsumed). If no row exists, return all zeros
  - [x] 3.6 Method `hasCreditsRemaining(userId: string): Promise<boolean>` — convenience: remaining > 0
  - [x] 3.7 Write co-located tests `creditService.test.ts` using DI pattern with a mock `db` object. Test: grant idempotency, consume success/failure, refund, balance calculation, no-row-exists case

- [x] Task 4: Create Zod validation schemas (AC: #2, #3)
  - [x] 4.1 Create `packages/validators/src/subscription.ts` — export schemas for credit operations (import z from `"zod/v4"`)
  - [x] 4.2 Schema `creditBalanceSchema = z.object({ totalGranted: z.number(), totalConsumed: z.number(), remaining: z.number() })`
  - [x] 4.3 Schema `consumeCreditResultSchema = z.object({ success: z.boolean(), remaining: z.number() })`
  - [x] 4.4 Export from `packages/validators/src/index.ts`

- [x] Task 5: Create subscription tRPC router (AC: #2, #3, #5, #6)
  - [x] 5.1 Create `packages/api/src/router/subscription.ts` using `satisfies TRPCRouterRecord` pattern
  - [x] 5.2 Procedure `getCredits` (protectedProcedure, query) — returns credit balance for authenticated user via creditService.getCreditBalance(ctx.session.user.id)
  - [x] 5.3 Procedure `grantInitialCredits` (protectedProcedure, mutation) — grants FREE_CREDITS_COUNT to user. Reads count from env. Idempotent (safe to call multiple times). Returns the updated credit balance
  - [x] 5.4 Procedure `consumeCredit` (protectedProcedure, mutation) — consumes 1 credit. Throws `TRPCError({ code: 'FORBIDDEN', message: 'INSUFFICIENT_CREDITS' })` if no credits remaining. Returns remaining count
  - [x] 5.5 Procedure `refundCredit` (protectedProcedure, mutation) — refunds 1 credit. Used after bad quality feedback
  - [x] 5.6 Procedure `getSubscriptionStatus` (protectedProcedure, query) — returns `{ isSubscriber: false, creditsRemaining: number, state: 'free_with_credits' | 'free_no_credits' }`. STUB: always returns `isSubscriber: false` (Story 4.2 will add real subscription checking). State is derived from credit balance
  - [x] 5.7 Register `subscriptionRouter` in `packages/api/src/root.ts`: `subscription: subscriptionRouter`
  - [x] 5.8 Write co-located tests `subscription.test.ts` — test all procedures using `appRouter.createCaller(ctx)` pattern (see `auth.test.ts` for reference). Test: getCredits returns zeros for new user, grantInitialCredits grants correct count, consumeCredit decrements, consumeCredit throws INSUFFICIENT_CREDITS at zero, refundCredit increments, getSubscriptionStatus returns correct state

- [x] Task 6: Wire credit grant to account creation flow (AC: #2)
  - [x] 6.1 In `apps/expo/src/app/(public)/sign-up.tsx` — after successful `authClient.signUp`, call `api.subscription.grantInitialCredits.mutate()` via tRPC
  - [x] 6.2 In `apps/expo/src/app/(public)/sign-in.tsx` — after successful sign-in for returning users, call `api.subscription.grantInitialCredits.mutate()` (idempotent — no-op if already granted)
  - [x] 6.3 Handle errors gracefully — credit grant failure should NOT block account creation. Log warning, show toast with info level, let user proceed. Credits can be granted later
  - [x] 6.4 Test: verify grant is called after sign-up, verify idempotency on sign-in

- [x] Task 7: Create CreditCounter component (AC: #5, #6)
  - [x] 7.1 Create `apps/expo/src/components/subscription/CreditCounter.tsx`
  - [x] 7.2 Uses `api.subscription.getSubscriptionStatus.useQuery()` to get status
  - [x] 7.3 If `isSubscriber === true`: render `null` (completely hidden per AC #6)
  - [x] 7.4 If free user with credits: render subtle text — "{remaining} free renders left" (ThemedText caption variant, text-secondary color). Follow UX spec: "subtle text, not a prominent warning"
  - [x] 7.5 If free user zero credits: render "Start free trial" text (ThemedText caption, text-secondary)
  - [x] 7.6 Use TanStack Query `isLoading` state — render null while loading (no flash of counter)
  - [x] 7.7 Props: `className?: string` for positioning flexibility
  - [x] 7.8 Add accessibilityLabel: "{remaining} free renders remaining" for VoiceOver
  - [x] 7.9 Write co-located test `CreditCounter.test.tsx` — test all three states (subscriber hidden, credits shown, zero credits shown)

- [x] Task 8: Create useSubscriptionStatus hook (AC: #4, #5, #6)
  - [x] 8.1 Create `apps/expo/src/hooks/useSubscriptionStatus.ts`
  - [x] 8.2 Wraps `api.subscription.getSubscriptionStatus.useQuery()` with clean return type
  - [x] 8.3 Returns: `{ isSubscriber: boolean; creditsRemaining: number; state: string; isLoading: boolean; canRender: boolean }` where `canRender = isSubscriber || creditsRemaining > 0`
  - [x] 8.4 Write co-located test `useSubscriptionStatus.test.ts`

- [x] Task 9: Add CreditCounter to profile screen (AC: #5)
  - [x] 9.1 Import CreditCounter into `apps/expo/src/app/(auth)/(tabs)/profile.tsx`
  - [x] 9.2 Place above the "Legal" section — shows credit balance for free users, hidden for subscribers
  - [x] 9.3 Wrap in a "Subscription" section with ThemedText caption header
  - [x] 9.4 The CreditCounter will later also be placed on the wardrobe screen (Story 2.2) and garment detail sheet (Story 3.1) — but those screens don't exist yet

- [x] Task 10: Typecheck, lint, and integration validation (AC: all)
  - [x] 10.1 Run `pnpm typecheck` — must pass across all packages
  - [x] 10.2 Run `pnpm lint` — must pass
  - [x] 10.3 Run `turbo test` — all tests pass (new + existing, 0 regressions)
  - [x] 10.4 Verify with Drizzle Studio that credits table exists and can be queried
  - [x] 10.5 Verify `pnpm db:push` completes without errors

## Dev Notes

### Story Context & Purpose

This is the first story in **Epic 4 (Monetization & Subscription)** and establishes the credit system foundation. It covers FR17 (free trial renders), FR18 (credit consumption per render), and FR21 (credit counter display). This story creates the backend infrastructure and client components that ALL subsequent monetization stories (4.2 IAP, 4.3 Paywall, 4.4 Webhooks) will build upon.

**Critical business rule:** Credits are NEVER consumed on failed renders. Only successful render completion deducts a credit. This is an architecture boundary documented in project-context.md.

**Scope boundaries:**
- IN SCOPE: Credits table, credit service, subscription router, CreditCounter UI, env config, credit grant on account creation
- OUT OF SCOPE: Apple IAP integration (Story 4.2), Paywall screen (Story 4.3), Apple webhooks (Story 4.4), ephemeral token system (Story 5.1), render pipeline integration (Story 3.2)
- STUB: `getSubscriptionStatus` returns `isSubscriber: false` — real subscription checking comes in Story 4.2

### Architecture Compliance

**Database schema follows Drizzle patterns:**
```typescript
// packages/db/src/schema.ts — ADD to existing file
import { createId } from "@paralleldrive/cuid2";

export const credits = pgTable("credits", (t) => ({
  id: t.text().primaryKey().$defaultFn(() => createId()),
  userId: t.text().notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  totalGranted: t.integer().notNull().default(0),
  totalConsumed: t.integer().notNull().default(0),
  createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdateFn(() => new Date()),
}));
```

- `casing: "snake_case"` auto-maps `userId` → `user_id`, `totalGranted` → `total_granted`, etc.
- DO NOT specify explicit column names like `t.text("user_id")` — let casing handle it
- `userId` is UNIQUE — one credit row per user (running balance model, not transaction log)
- Foreign key to `users.id` with `onDelete: "cascade"` — account deletion removes credits

**tRPC router follows existing patterns:**
- Use `satisfies TRPCRouterRecord` (see `packages/api/src/router/auth.ts` for reference)
- Access db via `ctx.db`, session via `ctx.session.user.id`
- `protectedProcedure` for all credit operations (auth required)
- Throw `TRPCError` with typed business codes, never generic `Error`

**Credit service uses dependency injection:**
```typescript
// packages/api/src/services/creditService.ts
export function createCreditService({ db }: { db: typeof import("@acme/db/client").db }) {
  return {
    async grantFreeCredits(userId: string, count: number) { ... },
    async consumeCredit(userId: string) { ... },
    async refundCredit(userId: string) { ... },
    async getCreditBalance(userId: string) { ... },
    async hasCreditsRemaining(userId: string) { ... },
  };
}
```

DI pattern enables testability — mock `db` in tests without `mock.module()` (which is irreversible in Bun).

### Credit Consumption — Atomic Operations

The `consumeCredit` method MUST be atomic to prevent race conditions (double-spend):

```typescript
// Atomic credit consumption — single SQL statement
const result = await db
  .update(credits)
  .set({ totalConsumed: sql`${credits.totalConsumed} + 1` })
  .where(
    and(
      eq(credits.userId, userId),
      lt(credits.totalConsumed, credits.totalGranted)
    )
  )
  .returning({ totalConsumed: credits.totalConsumed, totalGranted: credits.totalGranted });

if (result.length === 0) {
  return { success: false, remaining: 0 };
}
const row = result[0]!; // safe — we checked length
return { success: true, remaining: row.totalGranted - row.totalConsumed };
```

The WHERE clause `total_consumed < total_granted` makes it atomic — two concurrent requests cannot both succeed if only one credit remains.

### Subscription State Machine (Partial — Story 4.1)

The full state machine is: `no_account → free_with_credits → free_no_credits → trial → subscribed → expired`

Story 4.1 implements the first three states only:
- **free_with_credits**: `remaining > 0 && !isSubscriber`
- **free_no_credits**: `remaining === 0 && !isSubscriber`

The `getSubscriptionStatus` procedure returns:
```typescript
{
  isSubscriber: false, // STUB — always false until Story 4.2
  creditsRemaining: number,
  state: "free_with_credits" | "free_no_credits",
  canRender: boolean, // creditsRemaining > 0 || isSubscriber
}
```

Story 4.2 will extend this to include `trial`, `subscribed`, `expired` states and real subscription checking against the subscriptions table.

### CreditCounter UX Patterns

Per UX design specification:

| State | Display | Style |
|-------|---------|-------|
| Subscriber (trial/paid) | Hidden (render `null`) | N/A |
| Free, credits remaining | "X free renders left" | ThemedText caption, text-secondary |
| Free, zero credits | "Start free trial" | ThemedText caption, text-secondary |
| Loading | Hidden (render `null`) | N/A — no flash of counter |

- Counter is SUBTLE — caption variant (13px), secondary color (#6B6B6B). Not a badge, not a warning
- Never shows negative numbers — clamp to 0
- Subscribers NEVER see any monetization UI

### Environment Variable Configuration

```typescript
// apps/server/src/env.ts — ADD to existing schema
FREE_CREDITS_COUNT: z.coerce.number().int().min(0).default(3),
```

- Default: 3 (1 during onboarding + 2 after account creation = 3 total, but Story 5.1 handles the onboarding one)
- `z.coerce.number()` handles string env vars from Docker/Dokploy
- Changeable via Dokploy env vars without redeploying app binary
- Access in service: `import { env } from "../../env"` (from server package)

**IMPORTANT:** The env module is in `apps/server/src/env.ts`, but the credit service lives in `packages/api/src/services/`. The env value should be passed as a parameter to the service or router, NOT imported directly from the server package (that would create a cross-package dependency). Pass `freeCreditsCount` as a parameter to `grantFreeCredits`.

### Project Structure Notes

**New files to create:**
```
packages/api/src/services/creditService.ts         # Credit management logic
packages/api/src/services/creditService.test.ts     # Credit service tests
packages/api/src/router/subscription.ts             # Subscription tRPC router
packages/api/src/router/subscription.test.ts        # Router tests
packages/validators/src/subscription.ts             # Zod schemas for credits
apps/expo/src/components/subscription/CreditCounter.tsx      # Credit counter UI
apps/expo/src/components/subscription/CreditCounter.test.tsx  # UI tests
apps/expo/src/hooks/useSubscriptionStatus.ts        # Subscription status hook
apps/expo/src/hooks/useSubscriptionStatus.test.ts   # Hook tests
```

**Existing files to modify:**
```
packages/db/src/schema.ts                           # Add credits table
packages/api/src/root.ts                            # Register subscription router
apps/server/src/env.ts                              # Add FREE_CREDITS_COUNT
apps/expo/src/app/(public)/sign-up.tsx              # Call grantInitialCredits after signup
apps/expo/src/app/(public)/sign-in.tsx              # Call grantInitialCredits after signin (idempotent)
apps/expo/src/app/(auth)/(tabs)/profile.tsx         # Add CreditCounter display
.env.example                                        # Add FREE_CREDITS_COUNT=3
```

**Alignment with architecture document:**
- Service in `packages/api/src/services/` ✓
- Router in `packages/api/src/router/` ✓
- Component in domain folder `components/subscription/` ✓
- Hook in `hooks/` directory ✓
- Validator in `packages/validators/src/` ✓
- Tests co-located with source ✓
- No new dependencies needed — all libraries already installed ✓

### Key Dependencies

**This story depends on:**
- Story 1.1 (monorepo + DB setup) — DONE
- Story 1.3 (auth + users table + protectedProcedure) — DONE

**This story does NOT depend on:**
- Story 2.x (wardrobe) — CreditCounter will integrate when wardrobe exists
- Story 3.x (try-on) — Credit consumption API is ready but integration deferred
- Story 4.2 (IAP) — Subscription status is stubbed
- Story 5.x (onboarding) — Ephemeral token system is separate

**Stories that depend on this story:**
- Story 4.2 (Apple IAP) — extends subscription router, adds subscriptions table
- Story 4.3 (Paywall) — uses `getSubscriptionStatus` to trigger paywall
- Story 3.2 (render pipeline) — will call `consumeCredit` / `refundCredit`
- Story 3.4 (retry/feedback) — will call `refundCredit` on bad quality feedback
- Story 5.3 (account creation after first render) — will call `grantInitialCredits`

### Testing Approach

**Test runner: `bun test`**
**Imports: `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`**

**Credit service tests — DI pattern:**
```typescript
// packages/api/src/services/creditService.test.ts
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createCreditService } from "./creditService";

// Mock db with Drizzle-like API
const mockDb = {
  insert: mock(() => ({ values: mock(() => ({ onConflictDoNothing: mock(() => ({ returning: mock(() => Promise.resolve([])) })) })) })),
  update: mock(() => ({ set: mock(() => ({ where: mock(() => ({ returning: mock(() => Promise.resolve([])) })) })) })),
  select: mock(() => ({ from: mock(() => ({ where: mock(() => Promise.resolve([])) })) })),
};

const service = createCreditService({ db: mockDb as any });

describe("creditService", () => {
  beforeEach(() => { mock.restore(); });
  // ... tests
});
```

**Router tests — createCaller pattern (like auth.test.ts):**
```typescript
// packages/api/src/router/subscription.test.ts
const ctx = { db: mockDb, session: { user: { id: "test-user-id" } } };
const caller = appRouter.createCaller(ctx);

test("getCredits returns zero for new user", async () => {
  const result = await caller.subscription.getCredits();
  expect(result.remaining).toBe(0);
});
```

**Component tests — mock tRPC hook:**
```typescript
// apps/expo/src/components/subscription/CreditCounter.test.tsx
// Mock the API hook response, render component, assert output
```

### Key Pitfalls to Avoid

1. **DO NOT use auto-increment IDs.** Use `cuid2` string IDs: `t.text().primaryKey().$defaultFn(() => createId())`

2. **DO NOT specify explicit column names** in Drizzle schema (e.g., `t.text("user_id")`). Let `casing: "snake_case"` handle it automatically.

3. **DO NOT consume credits on failed renders.** This is an architecture boundary. The `consumeCredit` method should only be called AFTER a successful render completion.

4. **DO NOT use `useState` for loading states.** The CreditCounter must use TanStack Query's `isLoading` from the tRPC query, not a manual loading flag.

5. **DO NOT import env directly in `packages/api/`.** The env module lives in `apps/server/src/env.ts`. Pass `freeCreditsCount` as a parameter from the server to the service, not as a cross-package import.

6. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

7. **DO NOT create a transactions/ledger table.** The architecture specifies a simple running-balance model (totalGranted/totalConsumed), not a transaction log. Keep it simple.

8. **DO NOT make credit grant non-idempotent.** `grantInitialCredits` must be safe to call multiple times (e.g., user signs in on multiple devices). Only grant if `totalGranted === 0`.

9. **DO NOT show the CreditCounter to subscribers.** Render `null` when `isSubscriber === true`. Subscribers never see monetization UI.

10. **DO NOT block account creation if credit grant fails.** Credit grant is a non-critical side effect. Log the error, show a gentle toast, let the user proceed.

### Previous Story Intelligence

**From Story 1.4 (Privacy Consent — most recent completed story):**
- Test preload file established at `apps/expo/test/setup.ts` with `bunfig.toml` — reuse for CreditCounter component tests
- Mock patterns: react-native, expo-router, gluestack components all mocked in preload
- `SecureStore` mock using in-memory Map — reference pattern for any new storage mocks
- Profile screen has "Legal" section with ThemedPressable links — add "Subscription" section above it
- `Redirect` component + `useState` pattern for route guards — reference for any auth-aware routing
- 45 total tests passing (13 expo + 32 ui) — ensure 0 regressions

**From Story 1.3 (Auth — implemented in parallel):**
- `protectedProcedure` available and tested — use for all subscription router procedures
- Session provides `ctx.session.user.id` — the userId for credit operations
- Auth router test pattern with `createCaller` and mock context — replicate for subscription router
- better-auth `signUp` flow in sign-up.tsx — add credit grant call after successful signup
- better-auth `signIn` flow in sign-in.tsx — add idempotent credit grant call

**Code review patterns from Stories 1.1-1.4:**
- Always use semantic Tailwind tokens (never hardcoded hex in components)
- Always add accessibility attributes (`accessible`, `accessibilityRole`, `accessibilityLabel`)
- Button loading state: Spinner replaces text, button stays same size (no layout shift)
- When adding to profile.tsx: follow existing section pattern with ThemedText caption header

### Git Intelligence

**Recent commits (5):**
1. `a07217b` — docs: add execution threads to parallelization report
2. `2cf62b3` — docs: add sprint parallelization report
3. `e79226a` — feat: implement Story 1.3 — User Registration & Authentication
4. `6caaca8` — fix: Story 1.4 code review — ThemedPressable, consent gate tests, mock fixes
5. `3cd398b` — feat: implement Story 1.4 — Privacy Consent & Policy Screen

**Patterns established:**
- Conventional commits: `feat:` for implementation, `fix:` for code review corrections
- Single `feat:` commit per story implementation
- TypeScript strict compliance across all packages
- Co-located tests with `bun:test` — established in packages/api and apps/expo
- Test preload pattern with `bunfig.toml` — established in apps/expo and packages/ui

**Current branch:** `feat/4-1-credit-system` — already created for this story.

### References

- [Source: epics.md#Story 4.1] — Story definition and all acceptance criteria
- [Source: epics.md#Epic 4] — Monetization & Subscription epic overview (FR17-FR22)
- [Source: architecture.md#Data Architecture] — Database: Drizzle ORM, cuid2 IDs, snake_case casing
- [Source: architecture.md#API & Communication Patterns] — tRPC v11, domain-based routers, TRPCError codes
- [Source: architecture.md#Authentication & Security] — protectedProcedure, user session context
- [Source: architecture.md#Implementation Patterns] — Naming conventions, anti-patterns, testing patterns
- [Source: architecture.md#Project Structure & Boundaries] — File locations: services/, router/, components/subscription/
- [Source: architecture.md#Requirements to Structure Mapping] — Subscription (FR17-22) → subscription router → subscriptions+credits tables → subscription/* components
- [Source: ux-design-specification.md#Subscription Status Patterns] — Counter visibility rules per subscription state
- [Source: ux-design-specification.md#Typography System] — caption: Inter 13px Medium for counter text
- [Source: ux-design-specification.md#Color System] — text-secondary: #6B6B6B for subtle counter
- [Source: project-context.md#Architecture Boundaries] — Credits NEVER deducted on failed renders
- [Source: project-context.md#Business Error Codes] — INSUFFICIENT_CREDITS → FORBIDDEN
- [Source: project-context.md#Drizzle ORM Patterns] — casing: "snake_case", callback-style API
- [Source: project-context.md#tRPC Patterns] — satisfies TRPCRouterRecord, publicProcedure/protectedProcedure
- [Source: project-context.md#Testing Rules] — bun:test, DI pattern, mock.module irreversible
- [Source: 1-4-privacy-consent-and-policy-screen.md] — Test preload pattern, profile screen structure, mock patterns
- [Source: 1-3 commit (e79226a)] — Auth implementation, protectedProcedure, session context

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Test setup evolved from empty db mock to real PostgreSQL integration tests (test/setup.ts)
- Story 4.2 running in parallel modified subscription.ts, trpc.ts, index.ts — no conflicts, changes merged naturally
- ESLint `unstable_native_nodejs_ts_config` flag not supported on current Node.js version — pre-existing environment issue, not related to Story 4.1

### Completion Notes List

- Credits table created with cuid2 PK, unique userId FK, running-balance model (totalGranted/totalConsumed)
- Credit service uses DI pattern (`createCreditService({ db })`) — testable without mock.module
- Atomic credit consumption via SQL `WHERE total_consumed < total_granted` prevents double-spend
- `FREE_CREDITS_COUNT` configurable via server env (default: 3), passed through tRPC context (no cross-package import)
- Subscription router with 5 procedures: getCredits, grantInitialCredits, consumeCredit, refundCredit, getSubscriptionStatus
- `getSubscriptionStatus` initially stubbed with `isSubscriber: false` — Story 4.2 has already extended it with real subscription checking
- Credit grant wired to sign-up, sign-in, and Apple sign-in flows (idempotent, non-blocking)
- CreditCounter component: hidden for subscribers, shows "{N} free renders left" for free users, "Start free trial" for zero credits
- useSubscriptionStatus hook provides clean API: `{ isSubscriber, creditsRemaining, state, isLoading, canRender }`
- Profile screen has new "Subscription" section above "Legal" with CreditCounter
- 116 total tests passing (32 api + 52 expo + 32 ui), 0 regressions
- Typecheck passes on all Story 4.1 packages (db, api, validators, expo)
- tRPC proxy mock in expo test setup upgraded to recursive Proxy for chained property access

### File List

**New files:**
- packages/api/src/services/creditService.ts
- packages/api/src/services/creditService.test.ts
- packages/api/src/router/subscription.ts
- packages/api/src/router/subscription.test.ts
- packages/validators/src/subscription.ts
- apps/expo/src/components/subscription/CreditCounter.tsx
- apps/expo/src/components/subscription/CreditCounter.test.tsx
- apps/expo/src/hooks/useSubscriptionStatus.ts
- apps/expo/src/hooks/useSubscriptionStatus.test.ts

**Modified files:**
- packages/db/src/schema.ts (added credits table)
- packages/api/src/root.ts (registered subscriptionRouter)
- packages/api/src/trpc.ts (added freeCreditsCount to context)
- packages/api/test/setup.ts (real DB connection for integration tests)
- packages/validators/src/index.ts (export subscription schemas)
- apps/server/src/env.ts (added FREE_CREDITS_COUNT)
- apps/server/src/index.ts (pass freeCreditsCount to tRPC context)
- apps/expo/src/app/(public)/sign-up.tsx (credit grant after sign-up)
- apps/expo/src/app/(public)/sign-in.tsx (credit grant after sign-in)
- apps/expo/src/hooks/useAppleSignIn.ts (credit grant after Apple sign-in)
- apps/expo/src/app/(auth)/(tabs)/profile.tsx (added CreditCounter)
- apps/expo/test/setup.ts (added useQuery mock + recursive trpc proxy)
- .env.example (added FREE_CREDITS_COUNT=3)
- .env (created for local dev)

## Change Log

- 2026-02-15: Implemented Story 4.1 — Credit System & Free Trial Renders. Added credits table, credit service with DI, subscription tRPC router, CreditCounter component, useSubscriptionStatus hook, and wired credit grants to auth flows. 116 tests passing, 0 regressions.
