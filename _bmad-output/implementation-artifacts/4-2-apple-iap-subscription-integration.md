# Story 4.2: Apple IAP Subscription Integration

Status: done

## Story

As a user,
I want to subscribe to unlimited try-on renders through a simple in-app purchase,
So that I can try on any garment, anytime, without worrying about credits.

## Acceptance Criteria

1. **AC1 — Subscription Product Configuration:** Given the app uses Apple In-App Purchase, when the subscription product is configured, then a weekly auto-renewable subscription exists at ~$4.99/week with a 7-day free trial (FR19, FR20).

2. **AC2 — StoreKit 2 Client Integration:** Given the client-side integration, when StoreKit 2 is implemented, then the subscription product is loaded and available for purchase, and the native Apple payment sheet is presented on purchase.

3. **AC3 — Server-Side Receipt Validation:** Given a successful purchase, when the transaction completes, then the server validates the receipt via StoreKit 2 Server API, the subscription record is created/updated in the subscriptions table, and the user's subscription status is updated to "trial" or "subscribed".

4. **AC4 — Subscriptions Table:** Given the subscriptions table in Drizzle, when created, then it includes: id (cuid2), userId (FK), appleTransactionId, status (enum: trial, subscribed, expired, cancelled), startedAt, expiresAt, createdAt, updatedAt.

5. **AC5 — Subscription State Machine:** Given the subscription state machine, when states transition, then valid transitions are: no_account → free_with_credits → free_no_credits → trial → subscribed → expired, and state is consistent between client and server.

6. **AC6 — Subscription Status Query:** Given a user's subscription status, when queried via tRPC subscription router, then the current status, expiry date, and whether renders are allowed are returned, and the response determines UI behavior (counters, paywall, unlimited access).

## Dependencies

> **CRITICAL: Story 4.1 (Credit System & Free Trial Renders) is a prerequisite.**
> Story 4.1 creates the `credits` table and the credit tracking system. The subscription system interacts with credits: subscribers bypass credit checks, and the state machine transitions include `free_with_credits` and `free_no_credits`. If 4.1 is not implemented first, the developer must create stub/placeholder credit logic or implement both stories together.
>
> **Cross-epic dependencies:**
> - Story 1.3 (User Registration & Authentication) — **DONE** — auth infrastructure exists
> - Story 1.5 (Body Avatar Photo Management) — needed for renders but not blocking IAP itself

## Tasks / Subtasks

- [x] Task 1: Add subscriptions table to database schema (AC: #4)
  - [x] 1.1 Add `subscriptionStatus` pgEnum to `packages/db/src/schema.ts`
  - [x] 1.2 Add `subscriptions` table with all required columns
  - [x] 1.3 Add foreign key to users table with `onDelete: "cascade"` + `.unique()` for upsert
  - [x] 1.4 Export new schema from `packages/db/src/schema.ts`
  - [x] 1.5 Run `pnpm db:push` to sync schema to PostgreSQL

- [x] Task 2: Add Apple IAP environment variables (AC: #3)
  - [x] 2.1 Add env vars to `apps/server/src/env.ts` Zod schema (all optional for dev)
  - [x] 2.2 Update `.env.example` with new Apple IAP keys
  - [x] 2.3 Document required Apple App Store Connect setup in story notes

- [x] Task 3: Install dependencies (AC: #2, #3)
  - [x] 3.1 `pnpm add expo-iap --filter @acme/expo`
  - [x] 3.2 Add `"expo-iap"` to plugins array in `apps/expo/app.config.ts`
  - [x] 3.3 `pnpm add @apple/app-store-server-library --filter @acme/api`
  - [x] 3.4 Created `apps/server/certs/.gitkeep` with instructions for Apple Root CA certificates

- [x] Task 4: Create Apple IAP service layer (AC: #3, #5)
  - [x] 4.1 Create `packages/api/src/services/appleIap.ts` — factory functions with DI
  - [x] 4.2 Create `packages/api/src/services/subscriptionManager.ts` — subscription state machine
  - [x] 4.3 Write tests: appleIap.test.ts (4 tests), subscriptionManager.test.ts (10 tests)

- [x] Task 5: Create subscription tRPC router (AC: #6)
  - [x] 5.1 Extended `packages/api/src/router/subscription.ts` (built on 4.1) with:
    - `getStatus` (protectedProcedure) — returns current subscription status
    - `verifyPurchase` (protectedProcedure) — validates Apple transaction, creates subscription record
    - `restorePurchases` (protectedProcedure) — validates and restores Apple purchases
  - [x] 5.2 `subscriptionRouter` already registered in `packages/api/src/root.ts` (by 4.1)
  - [x] 5.3 Extended tests: 18/18 passing (7 new for IAP procedures)

- [x] Task 6: Create Apple webhook handler (AC: #3)
  - [x] 6.1 Create `apps/server/src/webhooks/apple.ts` — DI-based handler
  - [x] 6.2 Add webhook route to `apps/server/src/index.ts` — `/api/webhooks/apple`
  - [x] 6.3 JWS verification via SignedDataVerifier (DI interface)
  - [x] 6.4 Handle: TEST, SUBSCRIBED, DID_RENEW, EXPIRED, GRACE_PERIOD_EXPIRED, DID_FAIL_TO_RENEW, DID_CHANGE_RENEWAL_STATUS, REFUND, REVOKE
  - [x] 6.5 Write tests: apple.test.ts (7 tests)

- [x] Task 7: Create client-side IAP integration (AC: #1, #2)
  - [x] 7.1 Create `apps/expo/src/hooks/useStoreKit.ts` — wraps `useIAP` from expo-iap
  - [x] 7.2 Create `apps/expo/src/hooks/useSubscription.ts` — queries tRPC subscription.getStatus
  - [x] 7.3 Wire purchase flow: useStoreKit → onPurchaseSuccess → tRPC verifyPurchase → finishTransaction

- [x] Task 8: Integration verification (AC: #1-6)
  - [x] 8.1 All tests pass: API 51/51, Server 11/11
  - [x] 8.2 Typecheck passes: 13/13 packages
  - [x] 8.3 Lint: pre-existing env issue (Node.js version for eslint flag), not related to changes

## Dev Notes

### Architecture Compliance

**Database schema — subscriptions table:**
```typescript
// packages/db/src/schema.ts
// Use Drizzle callback-style API with casing: "snake_case"
// DO NOT use explicit column name strings — let casing handle it

export const subscriptionStatus = pgEnum("subscription_status", [
  "trial",
  "subscribed",
  "expired",
  "cancelled",
]);

export const subscriptions = pgTable("subscriptions", (t) => ({
  id: t.text().primaryKey().$defaultFn(() => createId()),
  userId: t.text().notNull().references(() => users.id, { onDelete: "cascade" }),
  appleTransactionId: t.text(),
  appleOriginalTransactionId: t.text(), // stable ID across renewals
  productId: t.text(),                  // Apple product SKU
  status: subscriptionStatus().notNull().default("trial"),
  startedAt: t.timestamp({ withTimezone: true }),
  expiresAt: t.timestamp({ withTimezone: true }),
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t
    .timestamp({ withTimezone: true })
    .$onUpdateFn(() => new Date())
    .notNull(),
}));
```

**State machine — subscription status transitions:**
```
no_account → (account created) → free_with_credits
free_with_credits → (credits exhausted) → free_no_credits
free_no_credits → (subscribes with trial) → trial
free_with_credits → (subscribes with trial) → trial
trial → (trial period ends, auto-renews) → subscribed
trial → (trial period ends, no renewal) → expired
subscribed → (renewal) → subscribed
subscribed → (cancellation, period ends) → expired
subscribed → (billing failure, grace period ends) → expired
expired → (resubscribes) → subscribed
```

Note: `no_account`, `free_with_credits`, `free_no_credits` are NOT stored in the subscriptions table — they are computed states derived from the absence of a subscription record combined with the credit balance (from Story 4.1). Only `trial`, `subscribed`, `expired`, `cancelled` are persisted enum values.

### Technical Requirements

**Server-side packages:**
- `@apple/app-store-server-library` v2.0.0 — Apple's official Node.js SDK for StoreKit 2 Server API
  - `AppStoreServerAPIClient` — authenticated API calls (getTransactionInfo, getAllSubscriptionStatuses)
  - `SignedDataVerifier` — verifies JWS signatures on webhooks and transaction payloads
  - Requires Apple Root CA certificates (download from https://www.apple.com/certificateauthority/): `AppleRootCA-G3.cer`, `AppleComputerRootCertificate.cer`, `AppleIncRootCertificate.cer`
  - Compatible with Bun runtime (uses standard Node.js crypto APIs)

**Client-side packages:**
- `expo-iap` v3.4.9 — Expo Module for StoreKit 2 on iOS
  - Uses `useIAP` hook for all IAP operations
  - **Requires development build** — does NOT work in Expo Go
  - Config plugin: add `"expo-iap"` to `app.json` plugins array
  - StoreKit 2 is the default on iOS 15+
  - Key methods: `fetchProducts`, `requestPurchase`, `finishTransaction`, `getAvailablePurchases`, `getActiveSubscriptions`
  - **NOT `react-native-iap`** — expo-iap is the Expo-native solution; react-native-iap uses Nitro Modules with Kotlin 2.2+ requirement that conflicts with expo-modules-core

**Environment variables to add to `apps/server/src/env.ts`:**
```typescript
// Add to the existing Zod schema:
APPLE_IAP_KEY_ID: z.string().min(1),         // App Store Connect API key ID (e.g., "ABCDEFGHIJ")
APPLE_IAP_ISSUER_ID: z.string().min(1),      // App Store Connect issuer ID (UUID)
APPLE_IAP_KEY_PATH: z.string().min(1),        // Path to .p8 private key file
APPLE_APP_ID: z.coerce.number().optional(),   // Apple App ID (numeric, required for production)
```

Note: `APPLE_BUNDLE_ID` already exists in env.ts from Story 1.3.

### Library & Framework Requirements

**`@apple/app-store-server-library` usage pattern:**

```typescript
// packages/api/src/services/appleIap.ts
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import type {
  JWSTransactionDecodedPayload,
  JWSRenewalInfoDecodedPayload,
  ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { readFileSync } from "node:fs";
import { env } from "../../apps/server/src/env"; // adjust path per actual import

// Apple Root CA certs — downloaded to apps/server/certs/
const appleRootCAs = [
  readFileSync("./certs/AppleRootCA-G3.cer"),
  readFileSync("./certs/AppleComputerRootCertificate.cer"),
  readFileSync("./certs/AppleIncRootCertificate.cer"),
];

const environment = env.NODE_ENV === "production"
  ? Environment.PRODUCTION
  : Environment.SANDBOX;

// SignedDataVerifier — for webhook JWS validation
export function createVerifier() {
  return new SignedDataVerifier(
    appleRootCAs,
    true,            // enableOnlineChecks (OCSP)
    environment,
    env.APPLE_BUNDLE_ID,
    env.NODE_ENV === "production" ? env.APPLE_APP_ID : undefined,
  );
}

// AppStoreServerAPIClient — for API calls
export function createAppleClient() {
  return new AppStoreServerAPIClient(
    readFileSync(env.APPLE_IAP_KEY_PATH, "utf-8"),
    env.APPLE_IAP_KEY_ID,
    env.APPLE_IAP_ISSUER_ID,
    env.APPLE_BUNDLE_ID,
    environment,
  );
}
```

**Use dependency injection** — create factory functions instead of module-level singletons so tests can inject mocks.

**`expo-iap` usage pattern (client):**

```typescript
// apps/expo/src/hooks/useStoreKit.ts
import { useIAP } from "expo-iap";
import type { Purchase } from "expo-iap";

const SUBSCRIPTION_SKU = "com.wearbloom.weekly"; // configure in App Store Connect

export function useStoreKit() {
  const {
    connected,
    subscriptions,
    activeSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    getActiveSubscriptions,
  } = useIAP({
    autoFinishTransactions: false, // we finish AFTER server validation
  });

  // Fetch subscription product on connect
  // requestPurchase with appAccountToken = userId (cuid2)
  // After server validates → finishTransaction({ purchase, isConsumable: false })
}
```

**Critical: `appAccountToken`** — When calling `requestPurchase`, set `appAccountToken` to the user's cuid2 ID. This links the Apple transaction to your user and is available in webhook payloads, enabling you to identify which user a webhook event belongs to.

### File Structure Requirements

**New files to create:**

```
packages/api/src/
  router/
    subscription.ts              # NEW — tRPC subscription router
  services/
    appleIap.ts                  # NEW — Apple API client + verifier factories
    appleIap.test.ts             # NEW — co-located tests
    subscriptionManager.ts       # NEW — subscription state machine + logic
    subscriptionManager.test.ts  # NEW — co-located tests

packages/db/src/
  schema.ts                      # MODIFY — add subscriptions table + enum

apps/server/src/
  env.ts                         # MODIFY — add Apple IAP env vars
  index.ts                       # MODIFY — add webhook route
  webhooks/
    apple.ts                     # NEW — App Store Server Notifications handler
    apple.test.ts                # NEW — co-located tests
  certs/
    AppleRootCA-G3.cer           # NEW — downloaded from Apple PKI
    AppleComputerRootCertificate.cer  # NEW
    AppleIncRootCertificate.cer       # NEW

apps/expo/
  app.json                       # MODIFY — add expo-iap plugin
  src/
    hooks/
      useStoreKit.ts             # NEW — expo-iap wrapper hook
      useSubscription.ts         # NEW — subscription status hook via tRPC
```

**Files to modify:**

| File | Change |
|------|--------|
| `packages/db/src/schema.ts` | Add `subscriptionStatus` enum + `subscriptions` table |
| `packages/api/src/root.ts` | Import and register `subscriptionRouter` |
| `apps/server/src/env.ts` | Add `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_KEY_PATH`, `APPLE_APP_ID` |
| `apps/server/src/index.ts` | Add `/api/webhooks/apple` route before tRPC catch-all |
| `apps/expo/app.json` | Add `"expo-iap"` to plugins array |

### Testing Requirements

**TDD — write failing tests FIRST for each component:**

| Component | Test File | Key Test Cases |
|-----------|-----------|---------------|
| subscriptionManager | `subscriptionManager.test.ts` | State transitions, status computation, edge cases (expired → resubscribe) |
| subscription router | `subscription.test.ts` | getStatus returns correct status, verifyPurchase creates record, restorePurchases validates |
| apple webhook | `apple.test.ts` | JWS verification, notification type handling (SUBSCRIBED, DID_RENEW, EXPIRED, REFUND), invalid signature rejection |
| appleIap service | `appleIap.test.ts` | Factory function creation, verifier configuration |

**Mocking strategy:**
- `@apple/app-store-server-library` — use `mock.module()` in `--preload` setup (third-party, irreversible is OK)
- `subscriptionManager` — use dependency injection (first-party, needs per-test isolation)
- Database calls — use `spyOn` on drizzle query methods with `mockRestore()` in `afterEach`

**Import from `"bun:test"` only** — never vitest or jest.

### Apple Webhook — Notification Handling Matrix

| NotificationType | Subtype | Action |
|-----------------|---------|--------|
| `SUBSCRIBED` | `INITIAL_BUY` | Create subscription record (status: "trial" if has trial, else "subscribed") |
| `SUBSCRIBED` | `RESUBSCRIBE` | Update subscription record (status: "subscribed"), set new expiresAt |
| `DID_RENEW` | — | Update expiresAt, ensure status = "subscribed" |
| `DID_RENEW` | `BILLING_RECOVERY` | Restore from billing retry, update status to "subscribed" |
| `DID_FAIL_TO_RENEW` | `BILLING_RETRY` | Log warning, subscription enters Apple's retry period |
| `DID_FAIL_TO_RENEW` | `GRACE_PERIOD` | User retains access during grace period per Apple policy |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_DISABLED` | Update status to "cancelled", keep access until expiresAt |
| `DID_CHANGE_RENEWAL_STATUS` | `AUTO_RENEW_ENABLED` | Revert status to "subscribed" if not expired |
| `EXPIRED` | `VOLUNTARY` | Status → "expired", user falls back to free tier |
| `EXPIRED` | `BILLING_RETRY` | Status → "expired" after failed billing retry |
| `REFUND` | — | Revoke access immediately, status → "expired" |
| `GRACE_PERIOD_EXPIRED` | — | Status → "expired" |
| `TEST` | — | Log only, no action |

**Webhook endpoint security:**
- Respond with HTTP 200 immediately after signature verification (Apple retries on non-200)
- Process subscription updates asynchronously if needed
- Log all webhook events with pino for debugging
- Use `SignedDataVerifier.verifyAndDecodeNotification()` — it handles the full x5c certificate chain verification

### Subscription Router — Procedure Design

```typescript
// packages/api/src/router/subscription.ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../trpc";

export const subscriptionRouter = {
  // Returns computed subscription state
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    // 1. Query subscriptions table for user
    // 2. If no subscription → check credits (Story 4.1)
    //    - credits > 0 → "free_with_credits"
    //    - credits === 0 → "free_no_credits"
    // 3. If subscription exists → return status + expiresAt
    // 4. Return: { status, expiresAt?, rendersAllowed, isUnlimited }
  }),

  // Validates Apple transaction and creates/updates subscription
  verifyPurchase: protectedProcedure
    .input(z.object({
      signedTransactionInfo: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Verify JWS with SignedDataVerifier
      // 2. Extract transaction details
      // 3. Validate appAccountToken matches ctx.session.user.id
      // 4. Create/update subscription record
      // 5. Return updated status
    }),

  // Restores purchases from Apple
  restorePurchases: protectedProcedure.mutation(async ({ ctx }) => {
    // 1. Client calls getAvailablePurchases() on expo-iap side
    // 2. Sends signed transactions to this endpoint
    // 3. Server validates each and restores access
  }),
} satisfies TRPCRouterRecord;
```

### Server Route Registration

```typescript
// apps/server/src/index.ts — add BEFORE the tRPC catch-all:
if (req.url?.startsWith("/api/webhooks/apple") && req.method === "POST") {
  handleAppleWebhook(req, res);
  return;
}
```

### App Store Connect Setup (Manual — Not Code)

The developer will need these configured in App Store Connect before testing:
1. Create an auto-renewable subscription product (product ID: e.g., `com.wearbloom.weekly`)
2. Set price to $4.99/week with 7-day free trial
3. Generate an App Store Connect API key (.p8 file) for StoreKit 2 Server API
4. Configure App Store Server Notifications V2 webhook URL (production: `https://api.wearbloom.app/api/webhooks/apple`)
5. Note the Key ID, Issuer ID, and download the .p8 key file

### Previous Story Intelligence

No Story 4.1 file exists (still in backlog). Relevant context from implemented stories:

**From Story 1.3 (User Registration & Authentication):**
- better-auth is fully configured with Apple OAuth + email/password
- Users table exists with cuid2 IDs
- Session management via expo-secure-store works
- `protectedProcedure` middleware validates auth on all protected endpoints
- Context provides `{ db, session }` — session.user.id is the user's cuid2 ID

**From Story 1.4 (Privacy Consent & Policy Screen):**
- Public route group `(public)` exists — paywall.tsx is already there (skeleton)
- Consent gate pattern established — can be referenced for subscription gate patterns

### Git Intelligence

Recent commits show implementation through Story 1.4 with code review fixes. Key patterns established:
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Code review process catches issues: ThemedPressable patterns, test mock fixes
- Tests use `bun:test` imports consistently
- Co-located test files confirmed in practice

### Project Structure Notes

- Route files are in `apps/expo/src/app/` (NOT `apps/expo/app/`)
- The `(public)` route group already exists with `paywall.tsx` (skeleton)
- No `components/subscription/` directory exists yet — will be needed for Story 4.3 (PaywallScreen)
- This story focuses on the **infrastructure** (database, service, router, webhook, hooks) — the PaywallScreen UI is Story 4.3

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security — Apple IAP validation]
- [Source: _bmad-output/planning-artifacts/architecture.md#External Integration Points — Apple IAP]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns — subscription router]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Journey 4: Subscription Paywall]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Subscription Status Patterns]
- [Source: CLAUDE.md#Critical Implementation Rules — all sections]
- [Source: @apple/app-store-server-library v2.0.0 — npm/GitHub]
- [Source: expo-iap v3.4.9 — npm/GitHub]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed missing UNIQUE constraint on `subscriptions.userId` — required for `onConflictDoUpdate` in upsertSubscription
- Fixed deep import paths `@acme/api/src/services/*` → `@acme/api/services/*` via sub-path exports in package.json
- Fixed `SignedDataVerifier` type incompatibility with DI interfaces — used `as unknown as` type assertions at integration boundary in server index.ts
- Fixed `expo-iap` API mismatches — original code used deprecated/nonexistent APIs (`ProductPurchase`, `currentPurchase`, `getSubscriptions`, `autoFinishTransactions`); rewrote to use actual v3.4.9 API (`Purchase`, `onPurchaseSuccess`/`onPurchaseError` callbacks, `fetchProducts`, `ExpoPurchaseError`)
- Story 4.1 was implemented in parallel — extended its subscription.ts router and test file rather than creating new ones; adapted to existing credits table and test setup

### Completion Notes List

- All 8 tasks completed successfully
- 62 tests passing across API (51) and Server (11) packages
- Full typecheck green (13/13 packages)
- Lint has pre-existing environment issue (Node.js version for `unstable_native_nodejs_ts_config` flag) — not related to this story
- Apple Root CA certificates need to be manually downloaded before production deployment
- App Store Connect product configuration (com.wearbloom.weekly) needed before sandbox testing
- The `useSubscriptionStatus` hook was created by Story 4.1 — `useSubscription` (this story) provides richer subscription data including expiresAt, productId, isUnlimited

### Change Log

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema.ts` | MODIFIED | Added `subscriptionStatus` pgEnum + `subscriptions` table with `.unique()` on userId |
| `packages/api/package.json` | MODIFIED | Added sub-path exports for `./services/appleIap` and `./services/subscriptionManager` |
| `packages/api/src/index.ts` | MODIFIED | Added `AppleIapDeps` type export |
| `packages/api/src/trpc.ts` | MODIFIED | Added `AppleIapDeps` interface + optional `appleIap` to context |
| `packages/api/src/services/appleIap.ts` | CREATED | Factory functions for Apple IAP client + verifier |
| `packages/api/src/services/appleIap.test.ts` | CREATED | 4 tests for Apple IAP service |
| `packages/api/src/services/subscriptionManager.ts` | CREATED | Subscription state machine + DB operations |
| `packages/api/src/services/subscriptionManager.test.ts` | CREATED | 10 tests for subscription manager |
| `packages/api/src/router/subscription.ts` | MODIFIED | Extended with getStatus, verifyPurchase, restorePurchases procedures |
| `packages/api/src/router/subscription.test.ts` | MODIFIED | Extended to 18 tests (7 new for IAP procedures) |
| `packages/api/test/setup.ts` | MODIFIED | Added subscriptions table cleanup |
| `apps/server/src/env.ts` | MODIFIED | Added optional Apple IAP env vars |
| `apps/server/src/index.ts` | MODIFIED | Added Apple IAP init + webhook route + tRPC context integration |
| `apps/server/src/webhooks/apple.ts` | CREATED | Apple App Store Server Notifications V2 webhook handler |
| `apps/server/src/webhooks/apple.test.ts` | CREATED | 7 tests for webhook handler |
| `apps/server/certs/.gitkeep` | CREATED | Placeholder with Apple Root CA cert instructions |
| `apps/expo/app.config.ts` | MODIFIED | Added `"expo-iap"` to plugins |
| `apps/expo/package.json` | MODIFIED | Added `expo-iap` dependency |
| `apps/expo/src/hooks/useStoreKit.ts` | CREATED | expo-iap wrapper hook with server validation flow |
| `apps/expo/src/hooks/useSubscription.ts` | CREATED | Subscription status query hook via tRPC |
| `.env.example` | MODIFIED | Added Apple IAP env var section |

### File List

**New files:**
- `packages/api/src/services/appleIap.ts`
- `packages/api/src/services/appleIap.test.ts`
- `packages/api/src/services/subscriptionManager.ts`
- `packages/api/src/services/subscriptionManager.test.ts`
- `apps/server/src/webhooks/apple.ts`
- `apps/server/src/webhooks/apple.test.ts`
- `apps/server/certs/.gitkeep`
- `apps/expo/src/hooks/useStoreKit.ts`
- `apps/expo/src/hooks/useSubscription.ts`

**Modified files:**
- `packages/db/src/schema.ts`
- `packages/api/package.json`
- `packages/api/src/index.ts`
- `packages/api/src/trpc.ts`
- `packages/api/src/router/subscription.ts`
- `packages/api/src/router/subscription.test.ts`
- `packages/api/test/setup.ts`
- `apps/server/src/env.ts`
- `apps/server/src/index.ts`
- `apps/expo/app.config.ts`
- `apps/expo/package.json`
- `.env.example`
