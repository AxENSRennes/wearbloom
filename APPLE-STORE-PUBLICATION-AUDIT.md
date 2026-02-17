# Apple Store Publication Audit

Date: 2026-02-17  
Scope: `apps/expo`, `apps/server`, `packages/api`, `packages/auth`

## Overall Status

Not ready for App Store publication yet.  
Primary blockers are in subscription entry flow, onboarding-to-render continuity, and production auth configuration.

## Findings

### P0 - Blockers

1. Subscription path is not reachable from the main try-on flow after credits run out.
   - `apps/expo/src/app/(auth)/(tabs)/index.tsx:123`
   - `apps/expo/src/hooks/usePaywallGuard.ts:6` (exists but not wired)
   - `apps/expo/src/components/subscription/CreditCounter.tsx:24` ("Start free trial" is informational only)

2. Onboarding "use own photo" is not persisted to backend body photo, so first real render can fail.
   - `apps/expo/src/app/(public)/sign-up.tsx:46`
   - `packages/api/src/router/tryon.ts:62` (`NO_BODY_PHOTO`)
   - `apps/expo/src/hooks/useStockPhotoStatus.ts:24`

### P1 - High Risk

3. Server auth URLs are hardcoded to localhost in startup path (including `productionUrl`).
   - `apps/server/src/index.ts:28`
   - `apps/server/src/index.ts:29`
   - `apps/server/src/env.ts:5` (no production auth URL env)

4. Expo app currently fails typecheck (release gate).
   - `apps/expo/src/components/profile/StockPhotoReplacementBanner.tsx:18`
   - Command run: `pnpm --filter @acme/expo typecheck`
   - Error: `Property 'primary' does not exist on type ...`

### P2 - Medium Risk (Resolved 2026-02-17)

5. Fixed: Broken navigation target after "Garment Saved".
   - Updated `apps/expo/src/app/(auth)/(tabs)/add.tsx` to push tabs root route `/(auth)/(tabs)/`.
   - Added regression coverage in `apps/expo/src/app/(auth)/(tabs)/add.test.tsx`.

6. Fixed: Consent copy conflicts with privacy copy.
   - Updated `apps/expo/src/app/(public)/consent.tsx` wording to explicitly allow essential processors (AI processing, Apple billing) and disallow advertising/marketing use.
   - Updated assertions in `apps/expo/src/app/(public)/consent.test.tsx`.

7. Fixed: Paywall spinner-only state when StoreKit product fetch fails.
   - Added explicit StoreKit product load states and retry API in `apps/expo/src/hooks/useStoreKit.ts`.
   - Added paywall fallback error UI with retry/restore/close actions in `apps/expo/src/components/subscription/PaywallScreen.tsx`.
   - Added coverage in `apps/expo/src/hooks/useStoreKit.test.ts` and `apps/expo/src/components/subscription/PaywallScreen.test.tsx`.

#### P2 Verification

- Command: `bun test "src/app/(auth)/(tabs)/add.test.tsx" "src/app/(public)/consent.test.tsx" "src/hooks/useStoreKit.test.ts" "src/components/subscription/PaywallScreen.test.tsx"` (run from `apps/expo`)
- Result: `67 passed, 0 failed`

## Recommended Fix Order

1. Wire paywall routing for `INSUFFICIENT_CREDITS`.
2. Persist onboarding photo into DB at account creation (or force body-photo completion).
3. Replace localhost auth URLs with env-configured production values.
4. Fix typecheck error and rerun `pnpm --filter @acme/expo typecheck`.
5. Fix broken `/(auth)/(tabs)/home` route push.
6. Align consent wording with privacy policy.
7. Add paywall fallback UI for product fetch failure.
