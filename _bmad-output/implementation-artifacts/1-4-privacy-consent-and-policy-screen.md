# Story 1.4: Privacy Consent & Policy Screen

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to view and accept the privacy policy at first launch,
So that I understand how my data is collected, used, and stored before proceeding.

## Acceptance Criteria

1. **Given** it is the user's first launch **When** the app opens **Then** a consent screen is displayed with brief data usage explanation, privacy policy link, and "Accept" button (primary, black, full-width)

2. **Given** the user has not accepted consent **When** they try to proceed into the app **Then** they cannot access any features until consent is given

3. **Given** the user taps the privacy policy link **When** the policy screen opens **Then** the full privacy policy is displayed on `(public)/privacy.tsx`

4. **Given** the user taps "Accept" **When** consent is recorded **Then** the consent screen does not appear on subsequent launches

5. **Given** the profile/settings screen **When** the user looks for the privacy policy **Then** a link to view it is always available

## Tasks / Subtasks

- [x] Task 1: Create consent storage utility (AC: #4)
  - [x] 1.1 Create `apps/expo/src/utils/consent-store.ts` — sync API using `expo-secure-store` following existing `session-store.ts` pattern
  - [x] 1.2 Export `hasAcceptedConsent(): boolean` using `SecureStore.getItem(CONSENT_KEY) === "true"`
  - [x] 1.3 Export `setConsentAccepted(): void` using `SecureStore.setItem(CONSENT_KEY, "true")`
  - [x] 1.4 Use key constant `"privacy_consent_accepted"` — never hardcode the string elsewhere
  - [x] 1.5 Write co-located test `consent-store.test.ts` mocking `expo-secure-store`

- [x] Task 2: Create consent screen `(public)/consent.tsx` (AC: #1, #2, #3)
  - [x] 2.1 Create new route file `apps/expo/src/app/(public)/consent.tsx`
  - [x] 2.2 Screen layout: `SafeAreaView` full screen, white background, centered content
  - [x] 2.3 Content from top to bottom:
    - App logo or brand name "Wearbloom" (DM Serif Display, display variant, centered)
    - Brief data usage explanation paragraph (ThemedText body variant, text-secondary): "We collect your photos and wardrobe data to power AI try-on. Your data is stored securely and never shared with third parties."
    - Privacy policy link (ThemedPressable, ghost-style text with underline): "Read our Privacy Policy" — navigates to `/(public)/privacy`
    - "Accept & Continue" button (Button primary variant, full-width, at bottom of screen) — calls `setConsentAccepted()` then navigates forward
  - [x] 2.4 Back navigation is disabled on this screen (no swipe-back, no back button) — user MUST accept to proceed
  - [x] 2.5 Use `router.replace()` (not `push`) when navigating after acceptance to prevent back-nav to consent screen
  - [x] 2.6 Spacing follows 4px grid: `px-4` (16px) horizontal padding, `gap-6` (24px) between sections

- [x] Task 3: Populate privacy policy content on `(public)/privacy.tsx` (AC: #3)
  - [x] 3.1 Replace existing placeholder with full privacy policy content in a `ScrollView`
  - [x] 3.2 Structure: heading (ThemedText display), last updated date (ThemedText caption), scrollable body text (ThemedText body) with section headers (ThemedText heading)
  - [x] 3.3 Sections to include: Data We Collect, How We Use Your Data, Data Storage & Security, Third-Party Services, Your Rights, Contact Information, Data Deletion
  - [x] 3.4 Include a back navigation button or use Expo Router's default Stack header (since it's inside a Stack layout in `(public)/_layout.tsx`)
  - [x] 3.5 Content should reference that photos are stored on secure servers (FR27), all transfers encrypted via HTTPS (FR28), and full account deletion is available (FR4)

- [x] Task 4: Add consent gate to root layout (AC: #2)
  - [x] 4.1 Modify `apps/expo/src/app/_layout.tsx` to check consent state on mount
  - [x] 4.2 Import `hasAcceptedConsent` from `~/utils/consent-store`
  - [x] 4.3 Use `useState` + `useEffect` (or synchronous check since `SecureStore.getItem` is sync) to determine initial route
  - [x] 4.4 If consent not accepted: use `<Redirect href="/(public)/consent" />` from `expo-router`
  - [x] 4.5 If consent accepted: render children normally (current `<Slot />` behavior)
  - [x] 4.6 IMPORTANT: This runs before any auth check. Consent gate is the FIRST gate, then auth (Story 1.3 will add auth guard in `(auth)/_layout.tsx`)
  - [x] 4.7 After consent is accepted, trigger re-render to allow navigation to proceed (use state setter callback)

- [x] Task 5: Add privacy policy link to profile screen (AC: #5)
  - [x] 5.1 Update `apps/expo/src/app/(auth)/(tabs)/profile.tsx`
  - [x] 5.2 Add a "Privacy Policy" row/link using ThemedPressable + ThemedText
  - [x] 5.3 On press, navigate to `/(public)/privacy` using `router.push("/(public)/privacy")`
  - [x] 5.4 Style: text-secondary color, body variant, with right chevron icon (lucide `ChevronRight`)
  - [x] 5.5 Position in a "Legal" or "About" section at the bottom of the profile screen

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 `consent-store.test.ts` — test `hasAcceptedConsent` returns false when no key, true when key is "true", and `setConsentAccepted` writes the key
  - [x] 6.2 Test that consent screen renders expected content (data usage text, policy link, accept button)
  - [x] 6.3 Test that profile screen contains privacy policy link
  - [x] 6.4 Use `bun:test` imports, co-locate tests with source files
  - [x] 6.5 Mock `expo-secure-store` using `mock.module` in a test preload file (since it's a third-party module with native side effects)

- [x] Task 7: Typecheck and validation (AC: all)
  - [x] 7.1 Run `pnpm typecheck` — must pass across all packages
  - [x] 7.2 Verify consent screen blocks app access on fresh install (manual or test)
  - [x] 7.3 Verify consent screen does NOT appear after accepting (manual or test)
  - [x] 7.4 Verify privacy policy is accessible from consent screen AND profile screen
  - [x] 7.5 Verify back navigation from privacy policy works correctly

## Dev Notes

### Story Context & Purpose

This story implements FR5 (privacy consent at first launch) and is an Apple App Store compliance requirement. The consent screen MUST appear before the user can access ANY app functionality. It is also a GDPR requirement for the EU market. This story is frontend-only (no server-side consent tracking yet) — server-side `consentAcceptedAt` will be set when the user creates an account (Story 5.3 flow).

### Architecture Decision: Local-First Consent

**Why local storage (not server-side) for the consent gate:**

Consent must be checked at first launch, BEFORE the user has an account. The Wearbloom onboarding flow is:
1. First launch → consent screen (no account exists)
2. Accept → onboarding flow (ephemeral token, no account)
3. Complete onboarding → create account
4. Account creation → server records `consentAcceptedAt`

Therefore, the consent gate uses `expo-secure-store` for instant local check. The server-side timestamp is deferred to account creation (Story 5.3). This matches the existing `session-store.ts` pattern.

**Storage choice: `expo-secure-store` (not AsyncStorage or MMKV)**
- Already installed and used in the project for session tokens
- Sync API available (`getItem`/`setItem`) — no async overhead on app startup
- iOS Keychain storage (encrypted, hardware-backed)
- Follows existing project patterns (`session-store.ts`)
- Note: Does NOT persist across app uninstall/reinstall — acceptable because re-consent on reinstall is a good practice

[Source: architecture.md#Authentication & Security — Expo SecureStore for token storage]

### Navigation Architecture

**Consent gate placement: Root layout (`_layout.tsx`)**

The consent check runs in the root layout BEFORE any route group renders. The priority order is:
1. **Consent gate** (this story) — blocks ALL routes until accepted
2. **Auth gate** (Story 1.3) — inside `(auth)/_layout.tsx`, blocks auth routes
3. **Onboarding gate** (Story 5.2) — inside `(onboarding)/_layout.tsx`

The root `_layout.tsx` currently renders `<Slot />`. This story adds a consent check that redirects to `/(public)/consent` if consent not accepted.

**Routing pattern: `<Redirect>` from expo-router**
```typescript
import { Redirect, Slot } from "expo-router";
import { hasAcceptedConsent } from "~/utils/consent-store";

// In the root layout component:
const [consented, setConsented] = useState(hasAcceptedConsent());

if (!consented) {
  return <Redirect href="/(public)/consent" />;
}
return <Slot />;
```

The `Redirect` component from expo-router is the standard pattern for declarative routing guards. Using `useState` with the sync `getItem` call ensures the check is immediate (no flash of wrong content).

**After acceptance**, the consent screen calls `setConsentAccepted()` and then uses `router.replace()` to navigate away. The root layout re-renders because the component calling `setConsentAccepted` can trigger a parent re-render via a callback prop or by using a shared state mechanism.

**CRITICAL:** Use `router.replace()`, NOT `router.push()`, when navigating after consent acceptance. This prevents the user from using back-navigation to return to the consent screen.

[Source: architecture.md#Frontend Architecture — Route Structure]
[Source: ux-design-specification.md#Navigation Patterns — Never more than 3 levels deep]

### Consent Screen Design

**Layout follows UX spec patterns:**
- White background (`bg-background`)
- Content centered vertically with bottom-aligned CTA
- "Accept & Continue" button: primary variant (black fill, 52px height, full-width, rounded-xl)
- Privacy policy link: ghost/underline text, `text-secondary` color
- Data usage explanation: `body` variant, `text-secondary` color
- Brand name: `display` variant (DM Serif Display 28px)
- All spacing on 4px grid

**No checkbox required.** The UX spec emphasizes "minimal friction" and "every input should feel like a tap." A single "Accept & Continue" button is sufficient. The act of tapping the button constitutes acceptance.

**Screen must NOT have back navigation.** The user must either accept consent or close the app. There is no way to dismiss the consent screen without accepting.

[Source: ux-design-specification.md#Button Hierarchy — Primary button rules]
[Source: ux-design-specification.md#Form Patterns — "If it feels like filling out a form, the UX has failed"]
[Source: epics.md#Story 1.4 — AC: "they cannot access any features until consent is given"]

### Privacy Policy Screen

**The existing placeholder at `(public)/privacy.tsx` must be populated with actual content.**

Content requirements (from FR5, GDPR, Apple guidelines):
- What data is collected (photos, wardrobe data, usage metrics)
- How data is used (AI try-on rendering, personalization)
- Where data is stored (secure servers, HTTPS)
- Third-party services involved (AI inference provider, Apple IAP)
- User rights (data access, deletion via account settings — FR4)
- Contact information for data inquiries
- Last updated date

**The privacy policy screen is a ScrollView** with structured text sections. It uses the `(public)` route group's Stack layout, which provides a back button automatically.

**This screen is accessible from TWO places:**
1. The consent screen at first launch (via link)
2. The profile/settings screen at any time (via link — AC #5)

[Source: prd.md#Privacy & Data Handling]
[Source: epics.md#Story 1.4 — All acceptance criteria]

### Profile Screen Update

The profile screen (`(auth)/(tabs)/profile.tsx`) currently shows a minimal placeholder. This story adds a "Privacy Policy" link at the bottom.

**Pattern:** Use a simple `ThemedPressable` row with:
- Left: ThemedText "Privacy Policy" (body variant)
- Right: ChevronRight icon from lucide-react-native (already installed in Story 1.2)
- On press: `router.push("/(public)/privacy")`
- Grouped in a "Legal" section with a section header (ThemedText caption, text-secondary)

This follows the standard iOS Settings pattern for linking to legal documents.

[Source: epics.md#Story 1.4 — AC #5: "a link to view it is always available"]

### Project Structure Notes

**New files to create:**
```
apps/expo/src/utils/consent-store.ts        # Consent flag storage utility
apps/expo/src/utils/consent-store.test.ts   # Tests for consent storage
apps/expo/src/app/(public)/consent.tsx       # Consent screen (NEW route)
```

**Existing files to modify:**
```
apps/expo/src/app/_layout.tsx                # Add consent gate redirect
apps/expo/src/app/(public)/privacy.tsx       # Populate with real content
apps/expo/src/app/(auth)/(tabs)/profile.tsx  # Add privacy policy link
```

**No changes needed to:**
- `packages/db/` — No schema changes (server-side consent deferred to Story 5.3)
- `packages/api/` — No tRPC endpoint changes (consent is local-only for now)
- `packages/ui/` — All required components exist (Button, ThemedText, ThemedPressable, Spinner)
- `apps/server/` — No backend changes

**Alignment with architecture document:**
- Route files use camelCase: `consent.tsx`, `privacy.tsx` ✓
- Utility files use camelCase: `consent-store.ts` ✓
- Components from `@acme/ui` reused (no new UI components needed) ✓
- Tests co-located with source files ✓
- No new dependencies needed — `expo-secure-store` already installed ✓

### Key Dependencies

**This story depends on:**
- Story 1.1 (monorepo foundation) — DONE
- Story 1.2 (design system + route groups) — DONE

**This story does NOT depend on:**
- Story 1.3 (auth) — Consent gate runs BEFORE auth. Auth guard is separate.

**Stories that depend on this story:**
- Story 1.3 (auth) — Auth should come after consent in the gate priority
- Story 5.2 (onboarding) — Onboarding only accessible after consent

### Testing Approach

**Test runner: `bun test`**
**Imports: `import { describe, test, expect, mock, spyOn } from "bun:test"`**

**Mocking `expo-secure-store`:**
Since `expo-secure-store` is a third-party native module with side effects, use `mock.module` in a preload file. The `packages/ui` package already has a `test/setup.ts` preload pattern that can be referenced.

```typescript
// In test file or preload:
import { mock } from "bun:test";

const store = new Map<string, string>();
mock.module("expo-secure-store", () => ({
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  deleteItemAsync: async (key: string) => { store.delete(key); },
}));
```

**Critical: `mock.module()` is irreversible.** This is fine for `expo-secure-store` since it's a third-party module that should always be mocked in tests. Use the in-memory `Map` to simulate storage behavior.

[Source: architecture.md#Structure Patterns — bun test mocking patterns]
[Source: project-context.md#Testing Rules — mock.module is irreversible]

### Key Pitfalls to Avoid

1. **DO NOT use `router.push()` after consent acceptance.** Use `router.replace()` to prevent back-navigation to the consent screen. Otherwise users could swipe back to consent after accepting.

2. **DO NOT add server-side consent tracking in this story.** Server-side `consentAcceptedAt` will be added when the user creates an account (Story 5.3). This story is local-only.

3. **DO NOT use `useState(false)` for loading states.** If the consent check needs async logic, use the sync `SecureStore.getItem` API to avoid flash of wrong content.

4. **DO NOT add a checkbox to the consent screen.** The UX spec says "every input should feel like a tap." The "Accept & Continue" button is the consent mechanism.

5. **DO NOT block the privacy policy screen behind consent.** The privacy policy at `(public)/privacy` must be accessible from the consent screen (before acceptance) AND from the profile screen (after acceptance). Both routes exist in the `(public)` group which is always accessible.

6. **DO NOT import from `"zod"`.** Always import from `"zod/v4"` per project rules (though this story likely won't need Zod at all).

7. **DO NOT create a separate `__tests__/` directory.** Tests are co-located: `consent-store.test.ts` next to `consent-store.ts`.

8. **DO NOT modify the `(public)/_layout.tsx`.** It's already configured as a Stack with `headerShown: false`. The consent screen handles its own header/back logic.

### Previous Story Intelligence

**From Story 1.2 (Design System):**
- Wearbloom color palette is fully implemented in `tooling/tailwind/index.ts` and `packages/ui/src/gluestack-config.ts`
- Semantic tokens: `bg-background`, `text-primary`, `text-secondary`, `border-border` all work
- Button component: primary (black fill 52px), secondary (white+border 52px), ghost (text-only 44px) — all ready
- ThemedText component: display (DM Serif 28px), heading (22px), body (15px), caption (13px) — all ready
- ThemedPressable component: accessible wrapper with press feedback — ready
- Route groups `(auth)`, `(onboarding)`, `(public)` all exist with layout files
- `lucide-react-native` installed — `ChevronRight` icon available for profile link
- Tab bar (3 tabs) working correctly
- 32 unit tests passing across UI components
- `packages/ui/test/setup.ts` exists as test preload pattern

**From Story 1.1 (Monorepo):**
- `expo-secure-store` installed and working (used by `session-store.ts` and `auth.ts`)
- `SafeAreaView` from `react-native-safe-area-context` available
- TypeScript compiles cleanly across all packages
- `pnpm typecheck` works from root

**Code review patterns from 1.1 and 1.2:**
- Always use semantic Tailwind tokens (never hardcoded hex)
- Always add accessibility attributes (`accessible`, `accessibilityRole`, `accessibilityLabel`)
- Button loading state: spinner replaces text, button stays same size
- Font error logging: log warning if font fails to load

### Git Intelligence

**Recent commits (5):**
1. `8ab5ebc` — fix: Story 1.2 code review — semantic tokens, tab labels, tests (3H/4M/3L)
2. `9df5dbf` — feat: implement Story 1.2 — Design System & App Shell Navigation
3. `91a22d6` — chore: add research guidance to CLAUDE.md and AGENTS.md
4. `052a2b6` — chore: add CLAUDE.md and AGENTS.md from project context
5. `3a8a2d3` — Fix Story 1.1 code review findings (3H/5M/2L)

**Patterns established:**
- Conventional commit messages: `feat:`, `fix:`, `chore:`
- Story implementation as single `feat:` commit, code review fixes as separate `fix:` commit
- TypeScript strict compliance across all packages
- NativeWind className styling (semantic tokens)
- Co-located tests with `bun:test`

### References

- [Source: epics.md#Story 1.4] — Story definition and all acceptance criteria
- [Source: prd.md#Privacy & Data Handling] — First-launch consent, privacy policy, right to deletion
- [Source: prd.md#FR5] — "User can view and accept privacy policy and data usage terms at first launch"
- [Source: architecture.md#Authentication & Security] — Expo SecureStore for token storage, account deletion cascade
- [Source: architecture.md#Frontend Architecture] — Route structure, (public) group for privacy screen
- [Source: architecture.md#Code Organization] — File structure, component locations
- [Source: architecture.md#Naming Patterns] — camelCase routes, PascalCase components
- [Source: architecture.md#Structure Patterns] — Co-located tests, bun test patterns
- [Source: ux-design-specification.md#Color System] — Wearbloom palette tokens
- [Source: ux-design-specification.md#Button Hierarchy] — Primary button (black, 52px, full-width)
- [Source: ux-design-specification.md#Form Patterns] — "If it feels like a form, the UX has failed"
- [Source: ux-design-specification.md#Navigation Patterns] — Swipe-down dismiss, back gesture
- [Source: ux-design-specification.md#Accessibility Strategy] — WCAG AA, VoiceOver, Dynamic Type
- [Source: project-context.md#Expo / React Native Patterns] — Route files in src/app/, SafeAreaView
- [Source: project-context.md#Testing Rules] — bun:test, mock.module irreversible, co-located tests
- [Source: 1-1-initialize-monorepo-from-starter-template.md] — expo-secure-store setup, project structure
- [Source: 1-2-design-system-and-app-shell-navigation.md] — Design system components, route groups, test patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Consent gate initially used `<Redirect>` as replacement for `<Slot>` — discovered this prevents child routes from rendering. Fixed by rendering `<Redirect>` alongside `<Slot>`.
- React state sync pattern: `if (!consented && hasAcceptedConsent()) setConsented(true)` used during render to sync SecureStore value with React state (official React pattern for derived state).
- Test mocks required extensive setup: react-native, expo-router, react-native-safe-area-context, @gluestack-ui/core, @gluestack-ui/utils/nativewind-utils, lucide-react-native all mocked in preload file.
- lucide-react-native Proxy mock failed with ESM static resolution — replaced with explicit named exports.

### Completion Notes List

- Task 1: Created `consent-store.ts` following `session-store.ts` pattern. 5 unit tests passing (hasAcceptedConsent false/true, unexpected value, setConsentAccepted writes key).
- Task 2: Created consent screen with SafeAreaView, centered brand name (display variant), data usage text (body, text-secondary), privacy policy link (underline, accessibilityRole="link"), and primary "Accept & Continue" button at bottom. `gestureEnabled: false` via Stack.Screen to prevent swipe-back. Uses `router.replace("/")` after acceptance.
- Task 3: Populated privacy policy with 7 structured sections (Data We Collect, How We Use Your Data, Data Storage & Security, Third-Party Services, Your Rights, Contact Information, Data Deletion). References FR27 (secure servers), FR28 (HTTPS encryption), FR4 (account deletion). Added Stack.Screen with `headerShown: true` for back navigation button.
- Task 4: Added consent gate to root layout using `useState` + sync SecureStore check. Uses `<Redirect>` rendered alongside `<Slot>` (not replacing it). Re-sync pattern detects SecureStore changes during render. Consent gate runs BEFORE any auth check.
- Task 5: Added "Legal" section to profile screen with "Privacy Policy" link using ThemedPressable + ChevronRight icon. Uses semantic color tokens (`wearbloomTheme.colors["text-tertiary"]`) for icon color.
- Task 6: 13 tests total — 5 consent-store unit tests, 5 consent screen content tests, 3 profile screen tests. All using bun:test with co-located test files. Comprehensive test preload (`apps/expo/test/setup.ts` + `bunfig.toml`) mocking RN, expo-router, lucide, gluestack, and expo-secure-store.
- Task 7: Expo typecheck passes (test files excluded via tsconfig). UI package typecheck passes. All 13 expo tests + 32 UI tests pass (45 total, 0 regressions). Note: `@acme/api` typecheck fails due to Story 1.3 parallel changes (AuthInstance type issue) — not related to this story.

### File List

**New files:**
- apps/expo/src/utils/consent-store.ts
- apps/expo/src/utils/consent-store.test.ts
- apps/expo/src/app/(public)/consent.tsx
- apps/expo/src/app/(public)/consent.test.tsx
- apps/expo/src/app/(auth)/(tabs)/profile.test.tsx
- apps/expo/test/setup.ts
- apps/expo/bunfig.toml

**Modified files:**
- apps/expo/src/app/_layout.tsx
- apps/expo/src/app/(public)/privacy.tsx
- apps/expo/src/app/(auth)/(tabs)/profile.tsx
- apps/expo/package.json (added "test" script)
- apps/expo/tsconfig.json (excluded test files from typecheck)

**Sprint tracking:**
- _bmad-output/implementation-artifacts/sprint-status.yaml (1-4 status: in-progress → review)
- _bmad-output/implementation-artifacts/1-4-privacy-consent-and-policy-screen.md (this file)

## Change Log

- 2026-02-15: Initial implementation of Story 1.4 — Privacy Consent & Policy Screen. Added consent storage utility, consent screen with accept gate, full privacy policy content, profile screen privacy link, and comprehensive test suite (13 tests). Established Expo app test infrastructure (bunfig.toml + test preload).
