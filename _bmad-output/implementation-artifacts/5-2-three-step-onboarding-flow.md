# Story 5.2: Three-Step Onboarding Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new user,
I want to be guided through a simple onboarding that shows me the app's magic,
So that I understand the value and feel excited to use it.

## Acceptance Criteria

1. **Given** the user has not completed onboarding, **When** the app opens, **Then** the OnboardingFlow is displayed as a horizontal pager with a step indicator (3 dots: active = black, inactive = light gray).

2. **Given** Step 1 — "Your Photo", **When** displayed, **Then** headline reads "First, let's see you" (DM Serif 28px), **And** subtext reads "Take a photo or use an example" (Inter 15px, gray), **And** a stock body photo is shown as preview (prominent, easy to select), **And** camera and gallery import buttons are available, **And** the user can proceed with the stock photo or their own (FR24).

3. **Given** Step 2 — "Pick a Garment", **When** displayed, **Then** headline reads "Now, choose something to try" (DM Serif 28px), **And** a grid of 6-8 curated stock garments is shown (selected for best render quality), **And** garments cover multiple categories for variety, **And** a "Or photograph your own" ghost link is available at the bottom, **And** a single tap selects a garment (FR24).

4. **Given** Step 3 — "See the Magic", **When** displayed, **Then** the AI render launches automatically using the selected body photo and garment, **And** the RenderLoadingAnimation plays (body photo base + shimmer + progress text), **And** on completion, the render result is displayed full-screen immersive (FR23).

5. **Given** the render result in Step 3, **When** the user is impressed, **Then** a CTA "Create Free Account" (primary black button) is displayed, **And** a secondary option "Try another combination" (ghost button) returns to Step 2.

6. **Given** the render result in Step 3, **When** the user wants to try another combination, **Then** they return to Step 2 to pick a different garment, **And** the flow remains within the onboarding (no account required).

7. **Given** any onboarding step, **When** an example/stock photo is available, **Then** it is clearly presented as the low-friction option at each step (FR24), **And** the user is never forced to provide their own photos to proceed.

## Tasks / Subtasks

- [x] Task 1: Install `react-native-reanimated-carousel` and create stock photo assets (AC: #1, #7)
  - [x] 1.1 Install `react-native-reanimated-carousel` (v5 beta for Reanimated v4 compat) + `react-native-worklets` via pnpm filter `@acme/expo`
  - [x] 1.2 Create `apps/expo/assets/stock/body/` directory with 1 stock body photo placeholder (PNG, ~800x1200)
  - [x] 1.3 Create `apps/expo/assets/stock/garments/` directory with 6-8 stock garment photos (PNG cutouts on transparent background, ~600x800)
  - [x] 1.4 Create `apps/expo/src/constants/stockAssets.ts` exporting typed stock asset references with category metadata

- [x] Task 2: Create `OnboardingFlow` pager component (AC: #1)
  - [x] 2.1 Create `apps/expo/src/components/onboarding/OnboardingFlow.tsx` — Carousel from `react-native-reanimated-carousel` with `loop={false}`, `width={screenWidth}`, 3 pages
  - [x] 2.2 Add `Pagination.Basic` step indicator dots: active = `#1A1A1A`, inactive = `#D1D5DB`, size = 10px, gap = 8px
  - [x] 2.3 Pass `useSharedValue` progress to Pagination for 60fps UI-thread animation
  - [x] 2.4 Expose `goToPage(index)` callback for programmatic navigation between steps
  - [x] 2.5 Write test for OnboardingFlow component rendering 3 pages with correct indicator

- [x] Task 3: Build Step 1 — "Your Photo" screen (AC: #2, #7)
  - [x] 3.1 Create `apps/expo/src/components/onboarding/StepYourPhoto.tsx`
  - [x] 3.2 Headline: "First, let's see you" using `ThemedText variant="display"` (DM Serif 28px)
  - [x] 3.3 Subtext: "Take a photo or use an example" using `ThemedText variant="body"` with `text-[#6B6B6B]`
  - [x] 3.4 Show stock body photo as prominent default preview (large, centered, ~60% screen width)
  - [x] 3.5 "Use this photo" primary black button below stock preview (proceeds with stock photo)
  - [x] 3.6 "Take a photo" and "Choose from gallery" secondary buttons for own photo
  - [x] 3.7 Use `expo-image-picker` for camera/gallery (request permissions, handle denial gracefully)
  - [x] 3.8 On photo selection (stock or own), call `onPhotoSelected(uri: string, isStock: boolean)` callback
  - [x] 3.9 Auto-advance pager to Step 2 after photo is confirmed
  - [x] 3.10 Write test for StepYourPhoto rendering and photo selection callback

- [x] Task 4: Build Step 2 — "Pick a Garment" screen (AC: #3, #7)
  - [x] 4.1 Create `apps/expo/src/components/onboarding/StepPickGarment.tsx`
  - [x] 4.2 Headline: "Now, choose something to try" using `ThemedText variant="display"`
  - [x] 4.3 Display stock garments in a 2-column grid (FlatList with `numColumns={2}`, 8px gap)
  - [x] 4.4 Each garment card: image fills card, 1:1.2 aspect ratio, rounded-xl (12px), press scale 0.97x via Reanimated
  - [x] 4.5 Selected garment shows a 2px black border highlight
  - [x] 4.6 "Or photograph your own" ghost link at bottom (opens camera/gallery via expo-image-picker)
  - [x] 4.7 On garment selection, call `onGarmentSelected(uri: string, category: string, isStock: boolean)` callback
  - [x] 4.8 Auto-advance pager to Step 3 after garment tap (500ms delay for visual feedback)
  - [x] 4.9 Write test for StepPickGarment rendering and garment selection

- [x] Task 5: Build Step 3 — "See the Magic" render screen (AC: #4, #5, #6)
  - [x] 5.1 Create `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx`
  - [x] 5.2 On mount: trigger anonymous sign-in via `authClient.signIn.anonymous()` if not already signed in
  - [x] 5.3 Implement render loading animation: body photo as base layer + shimmer overlay (Reanimated) + pulsing scale (1.0→1.02→1.0, 2s loop)
  - [x] 5.4 Progress text sequence: "Creating your look..." (0-3s) → "Almost there..." (7-10s) → "Taking a bit longer..." (10s+)
  - [x] 5.5 **Render integration:** Call `tryon.requestRender` via `ephemeralProcedure` with selected body photo + garment — **NOTE: Render pipeline (Epic 3) and image upload (Epic 2) do not exist yet. Implement a mock render service that returns a placeholder result image after 3-5s delay. Add `// TODO(Epic-3): Replace mock with real tryon.requestRender` marker.**
  - [x] 5.6 On render "complete": cross-fade transition (500ms ease) from body photo to result image, medium haptic feedback via `expo-haptics`
  - [x] 5.7 Display CTAs: "Create Free Account" primary black button + "Try another combination" ghost button
  - [x] 5.8 "Try another combination" navigates pager back to Step 2 (keeps body photo, resets garment)
  - [x] 5.9 "Create Free Account" navigates to `/(public)/sign-up` via `router.push("/(public)/sign-up")`
  - [x] 5.10 Implement Reduce Motion support: replace shimmer with static spinner + text, replace cross-fade with instant swap
  - [x] 5.11 Write tests for StepSeeTheMagic: loading state, completion state, CTA actions

- [x] Task 6: Integrate onboarding route and navigation logic (AC: #1)
  - [x] 6.1 Create `apps/expo/src/app/(onboarding)/index.tsx` — imports and renders `OnboardingFlow`
  - [x] 6.2 Update `apps/expo/src/app/_layout.tsx` — add onboarding routing logic:
    - After consent check, check if user has completed onboarding (use AsyncStorage flag `onboarding_completed`)
    - If not completed → redirect to `/(onboarding)`
    - If completed → continue to existing auth flow
  - [x] 6.3 Create `apps/expo/src/utils/onboardingState.ts` — helpers: `hasCompletedOnboarding()`, `markOnboardingComplete()` using `@react-native-async-storage/async-storage`
  - [x] 6.4 After "Create Free Account" or "Skip" (if future), call `markOnboardingComplete()` before navigation
  - [x] 6.5 Write test for onboarding state helpers

- [x] Task 7: Accessibility and polish (AC: #1-7)
  - [x] 7.1 Add `accessibilityLabel` to all interactive elements (pager dots, buttons, garment cards, photo options)
  - [x] 7.2 VoiceOver: Carousel pages labeled "Onboarding step 1 of 3", "Onboarding step 2 of 3", etc.
  - [x] 7.3 Dynamic Type: all text uses `allowFontScaling={true}`, `maxFontSizeMultiplier={1.5}`
  - [x] 7.4 Touch targets: all buttons minimum 44x44px (use `hitSlop` on smaller elements)
  - [x] 7.5 SafeAreaView wrapping for notch/home indicator handling

## Dev Notes

### Architecture Decision: Single-Route Pager (NOT Separate Routes)

Use a SINGLE route `(onboarding)/index.tsx` with `react-native-reanimated-carousel` as pager component. Do NOT create separate `step1.tsx`, `step2.tsx`, `step3.tsx` routes.

**Why:** An onboarding flow is a single conceptual screen with swipeable content. Using separate Expo Router routes creates navigation stack overhead, fights swipe gestures (iOS edge-swipe-back vs page-swipe), and makes state sharing complex. A single route with pager component keeps state local (`currentPage`), provides native swipe gestures, and allows `router.replace()` on completion.

### Library Choice: `react-native-reanimated-carousel`

**Install:** `pnpm add react-native-reanimated-carousel@next react-native-worklets --filter @acme/expo`

- v5.0.0-beta supports Reanimated v4 + Expo SDK 54 (your exact version matrix)
- Built-in `Pagination.Basic` component gives animated step indicator dots for free
- `useSharedValue` progress tracking for 60fps UI-thread dot animations
- `loop={false}` mode with `width={screenWidth}` behaves as a standard pager
- Already have `react-native-reanimated` and `react-native-gesture-handler` installed

**Alternative considered:** `react-native-pager-view` (lighter but no built-in pagination — more manual work for dots).

### Render Integration Strategy (Critical)

**The render pipeline (Epic 3) does NOT exist yet.** Neither does the image upload system (Epic 2) or body avatar management (Story 1.5). The onboarding flow MUST be built with a mock render service.

**Mock approach:**
```typescript
// apps/expo/src/services/mockRenderService.ts
// TODO(Epic-3): Replace with real tryon.requestRender via ephemeralProcedure

export async function mockRequestRender(
  _bodyPhotoUri: string,
  _garmentUri: string,
): Promise<{ resultUri: string }> {
  // Simulate 3-5s render delay
  await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 2000));
  // Return the body photo as the "render result" (placeholder)
  return { resultUri: _bodyPhotoUri };
}
```

When Epic 3 is implemented, replace the mock with:
```typescript
const result = await api.tryon.requestRender.mutate({
  garmentId: selectedGarment.id,
});
```

The `ephemeralProcedure` middleware (Story 5.1) is already in place and will authorize the anonymous user's first render.

### Anonymous Sign-In Flow

Story 5.1 established the anonymous auth system. The onboarding flow uses it like this:

```
[App opens → no session exists]
  → Check onboarding_completed flag (AsyncStorage)
  → If NOT completed → redirect to /(onboarding)
  → Step 3: call authClient.signIn.anonymous()
    → Creates anonymous user (isAnonymous: true)
    → Session token stored in SecureStore automatically
  → Mock render proceeds using ephemeral session
  → "Create Free Account" → /(public)/sign-up
    → better-auth onLinkAccount fires → anonymous user data migrated
    → markOnboardingComplete() called
    → Navigate to /(auth)/(tabs)
```

**Key:** Anonymous sign-in happens lazily at Step 3 (not at app launch). This avoids creating anonymous users who never reach the render step.

### Stock Photos Strategy

**Bundle stock photos as app assets** (not server-side). Stock photos are needed immediately at app launch, before any network call.

**Directory structure:**
```
apps/expo/assets/stock/
  body/
    stock-body-01.png          # Full-body stock photo (~800x1200px)
  garments/
    stock-garment-tops-01.png  # Cutout on transparent bg (~600x800px)
    stock-garment-tops-02.png
    stock-garment-bottoms-01.png
    stock-garment-bottoms-02.png
    stock-garment-dresses-01.png
    stock-garment-dresses-02.png
    stock-garment-outerwear-01.png
    stock-garment-shoes-01.png
```

**Asset references** (`apps/expo/src/constants/stockAssets.ts`):
```typescript
import type { ImageSourcePropType } from "react-native";

interface StockGarment {
  id: string;
  source: ImageSourcePropType;
  category: "tops" | "bottoms" | "dresses" | "outerwear" | "shoes";
  label: string;
}

export const STOCK_BODY_PHOTO = require("../../assets/stock/body/stock-body-01.png") as ImageSourcePropType;

export const STOCK_GARMENTS: StockGarment[] = [
  { id: "stock-tops-01", source: require("../../assets/stock/garments/stock-garment-tops-01.png"), category: "tops", label: "White T-Shirt" },
  { id: "stock-tops-02", source: require("../../assets/stock/garments/stock-garment-tops-02.png"), category: "tops", label: "Blue Blouse" },
  // ... 6-8 total
];
```

**CRITICAL:** Use `require()` for local assets (not `import`). Metro bundler resolves `require()` at build time for images. The typing uses `ImageSourcePropType` for compatibility with `expo-image` `source` prop.

**Placeholder stock photos:** For initial development, use solid-color PNG rectangles as placeholders. Replace with real curated stock photos before TestFlight.

### Onboarding State Persistence

Use `AsyncStorage` (NOT SecureStore) for onboarding completion flag. This is non-sensitive data — a simple boolean flag.

```typescript
// apps/expo/src/utils/onboardingState.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "onboarding_completed";

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
```

**Why AsyncStorage over a database flag?** Onboarding happens before account creation. There is no user record to attach it to. The flag persists locally per-device, which is the correct behavior (re-onboarding on a new device is acceptable).

**Install if not present:** `pnpm add @react-native-async-storage/async-storage --filter @acme/expo`

### Root Layout Navigation Logic Update

The root `_layout.tsx` currently checks consent then renders `<Slot />`. Update to add onboarding check:

```
Consent check → if not consented → /(public)/consent
  → Onboarding check → if not completed → /(onboarding)
    → Auth check (existing) → if not signed in → /(public)/sign-in
      → /(auth)/(tabs) (main app)
```

The onboarding check should happen AFTER consent (user must accept privacy policy first) and BEFORE the auth check (onboarding works without an account).

### Component Structure

```
apps/expo/src/components/onboarding/
  OnboardingFlow.tsx          # Carousel pager + Pagination dots + state
  StepYourPhoto.tsx           # Step 1: Body photo selection
  StepPickGarment.tsx         # Step 2: Garment selection grid
  StepSeeTheMagic.tsx         # Step 3: Render + CTAs
```

All components in `apps/expo/src/components/onboarding/` per project naming conventions. Do NOT place at root of `components/`.

### Existing Code to Reuse

| Existing Code | Use In This Story |
|---|---|
| `@acme/ui` `Button` (primary/secondary/ghost variants) | All CTAs in onboarding steps |
| `@acme/ui` `ThemedText` (display/body/caption variants) | All headlines and text |
| `@acme/ui` `Spinner` | Fallback loading indicator |
| `authClient.signIn.anonymous()` from Story 5.1 | Step 3 anonymous sign-in |
| `auth.getEphemeralStatus` procedure from Story 5.1 | Check if user already has anonymous session |
| `(onboarding)/_layout.tsx` | Already exists — basic Stack with headerShown: false |
| `useAppleSignIn` hook | Reuse for account creation after render |

### Files to Create

| File | Purpose |
|---|---|
| `apps/expo/src/app/(onboarding)/index.tsx` | Onboarding route screen |
| `apps/expo/src/components/onboarding/OnboardingFlow.tsx` | Carousel pager with pagination |
| `apps/expo/src/components/onboarding/StepYourPhoto.tsx` | Step 1 body photo |
| `apps/expo/src/components/onboarding/StepPickGarment.tsx` | Step 2 garment grid |
| `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx` | Step 3 render + CTAs |
| `apps/expo/src/constants/stockAssets.ts` | Stock photo asset references |
| `apps/expo/src/utils/onboardingState.ts` | AsyncStorage completion flag |
| `apps/expo/src/services/mockRenderService.ts` | Temporary mock render (until Epic 3) |
| `apps/expo/assets/stock/body/stock-body-01.png` | Stock body photo |
| `apps/expo/assets/stock/garments/stock-garment-*.png` | 6-8 stock garment photos |

### Files to Modify

| File | Change |
|---|---|
| `apps/expo/src/app/_layout.tsx` | Add onboarding completion check and redirect |
| `apps/expo/package.json` | Add `react-native-reanimated-carousel`, `react-native-worklets`, `@react-native-async-storage/async-storage` (if not present), `expo-image-picker` (if not present), `expo-haptics` (if not present) |

### Critical Constraints

1. **Do NOT create separate route files for each step.** Use a single `(onboarding)/index.tsx` with pager component.
2. **Do NOT call real render APIs.** Use the mock render service. The render pipeline does not exist yet.
3. **Anonymous sign-in happens at Step 3 ONLY**, not at app launch. Avoid phantom anonymous users.
4. **Stock photos are app-bundled assets**, not fetched from server. They must work offline at first launch.
5. **Use `require()` for stock photo imports** — Metro resolves them at build time. `import` does not work for image assets.
6. **Zod imports from `"zod/v4"`** — not `"zod"`.
7. **All `bun:test` imports** — never vitest/jest.
8. **No `useState` for loading states** — but since this is pre-TanStack-Query (mock render), a local `useState` for the mock render loading state is acceptable here. Add `// TODO(Epic-3): Replace with TanStack Query mutation state` comment.
9. **`expo-image`** for all image display — not `Image` from react-native. Provides caching and lazy loading.
10. **NativeWind classes** for all styling — no `StyleSheet.create()` except where Reanimated requires plain style objects (carousel dot styles).

### UX Specifications (from UX Design Doc)

**Step indicator:** 3 dots at top. Active = `#1A1A1A` (black), inactive = `#D1D5DB` (light gray). Size 10px, gap 8px.

**Render loading animation:**
- Body photo as base layer (from local selection, already available)
- Shimmer overlay sweeping across image (Reanimated)
- Subtle pulsing scale: 1.0x → 1.02x → 1.0x, 2s loop
- Progress text (Inter 13px, semi-transparent white):
  - 0-3s: "Creating your look..."
  - 3-7s: (add floating garment thumbnail — skip for now, complex)
  - 7-10s: "Almost there..."
  - 10s+: "Taking a bit longer..."

**Render result display:**
- Cross-fade transition 500ms ease from body photo to result
- Medium haptic feedback on completion (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`)
- CTAs appear with fade-in (200ms)

**Reduce Motion:**
- Replace shimmer with static "Loading..." text + Spinner
- Replace cross-fade with instant image swap
- Use `useReducedMotion()` from `react-native-reanimated`

**Button specs:**
- Primary: `bg-[#1A1A1A] text-white h-[52px] w-full rounded-xl`
- Ghost: `text-[#6B6B6B] h-[44px]`
- Press state: scale 0.97x + opacity 0.9, 100ms spring

### Testing Strategy

**TDD: Write tests first for each component.**

| Component | Test Scenarios |
|---|---|
| `OnboardingFlow` | Renders 3 pages, pagination dots visible, programmatic navigation works |
| `StepYourPhoto` | Renders headline/subtext, stock photo visible, "Use this photo" callback fires, camera/gallery buttons present |
| `StepPickGarment` | Renders garment grid, tap selects garment, callback fires with correct data |
| `StepSeeTheMagic` | Loading animation renders, "complete" state shows CTAs, "Create Account" navigates correctly, "Try another" navigates back |
| `onboardingState` | `hasCompletedOnboarding` returns false initially, `markOnboardingComplete` sets flag, subsequent check returns true |
| `mockRenderService` | Returns result after delay, returns valid URI |

**Mocking approach:**
- Mock `expo-image-picker` with `mock.module()` in test preload (irreversible but acceptable — third-party)
- Mock `expo-haptics` with `mock.module()` in test preload
- Mock `expo-router` with `mock.module()` — mock `router.push`, `router.replace`
- Use dependency injection for `mockRenderService` in `StepSeeTheMagic`
- Use `spyOn` for `authClient.signIn.anonymous()` — restore in `afterEach`

### Cross-Story Dependencies

| Story | Dependency Type | Detail |
|---|---|---|
| Story 5.1 (Ephemeral Token) | Builds on | Uses `authClient.signIn.anonymous()`, `ephemeralProcedure`, `getEphemeralStatus` |
| Story 1.2 (Design System) | Uses | Button, ThemedText, Spinner from `@acme/ui` |
| Story 1.4 (Privacy Consent) | Prerequisite | Consent must be accepted before onboarding shows |
| Story 3.2 (Render Pipeline) | Forward dependency | Real render replaces mock service |
| Story 2.1 (Garment Upload) | Forward dependency | Real garment upload replaces stock-only approach |
| Story 1.5 (Body Avatar) | Forward dependency | Real body photo upload replaces local-only approach |
| Story 5.3 (Account Creation) | Consumed by | "Create Free Account" CTA navigates to sign-up |

### Project Structure Notes

- All new components in `apps/expo/src/components/onboarding/` (domain directory)
- Constants in `apps/expo/src/constants/` (existing pattern)
- Utils in `apps/expo/src/utils/` (existing pattern)
- Services in `apps/expo/src/services/` (new directory for client-side services)
- Stock assets in `apps/expo/assets/stock/` (new directory)
- Tests co-located with source files (`.test.tsx` next to `.tsx`)
- Route file in `apps/expo/src/app/(onboarding)/index.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — Acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — Route structure, component patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — Ephemeral token, anonymous sign-in
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Journey 1: First-Time Onboarding] — Full onboarding flow spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#OnboardingFlow Component] — Component anatomy and states
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#RenderLoadingAnimation Component] — Loading animation spec
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design System Foundation] — Colors, typography, spacing
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Strategy] — VoiceOver, Dynamic Type, Reduce Motion
- [Source: _bmad-output/implementation-artifacts/5-1-ephemeral-token-and-pre-account-authorization.md] — Previous story implementation details, anonymous auth patterns
- [Source: _bmad-output/project-context.md] — Full project rules and constraints
- [Source: react-native-reanimated-carousel docs] — Carousel + Pagination.Basic API

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- FlatList mock updated to render items from `data`/`renderItem` to enable SSR-based testing of grid components
- Bun image loader plugin added to test setup to handle `require("*.png")` in stockAssets
- Root layout `onboardingDone` state changed from blocking `null` to non-blocking pattern to preserve existing tests while supporting async AsyncStorage check

### Completion Notes List

- **Task 1:** Installed `react-native-reanimated-carousel@beta`, `react-native-worklets`, `expo-image-picker`, `expo-haptics`, `@react-native-async-storage/async-storage`, `expo-image`. Created 9 placeholder stock PNG images (1 body, 8 garments) and typed `stockAssets.ts` constants.
- **Task 2:** Created `OnboardingFlow.tsx` with `react-native-reanimated-carousel` `Carousel` (loop=false, width=screenWidth), `Pagination.Basic` dots (active=#1A1A1A, inactive=#D1D5DB, 10px, 8px gap), `useSharedValue` progress tracking, and `goToPage(index)` programmatic navigation via ref.
- **Task 3:** Created `StepYourPhoto.tsx` with DM Serif headline, stock body photo preview via `expo-image`, "Use this photo" primary CTA, "Take a photo" / "Choose from gallery" buttons using `expo-image-picker` with permission handling. Auto-advances to Step 2 on selection.
- **Task 4:** Created `StepPickGarment.tsx` with 2-column FlatList grid (8px gap), garment cards with 1:1.2 aspect ratio, selected state with 2px black border, "Or photograph your own" ghost link. Auto-advances to Step 3 on selection (500ms delay).
- **Task 5:** Created `StepSeeTheMagic.tsx` with Reanimated pulsing scale animation (1.0→1.02→1.0, 2s loop), progress text sequence, mock render service (3-5s delay), haptic feedback on completion, Reduce Motion support (static Spinner fallback), "Create Free Account" / "Try another combination" CTAs.
- **Task 6:** Created `(onboarding)/index.tsx` route screen, `onboardingState.ts` helpers (AsyncStorage), updated root `_layout.tsx` to check onboarding completion after consent and redirect to `/(onboarding)` if not completed.
- **Task 7:** Added VoiceOver labels ("Onboarding step X of 3"), accessibility roles, ensured all interactive elements have `accessibilityLabel`, SafeAreaView wrapping on all steps.

### Change Log

- 2026-02-16: Story 5.2 implementation complete — Three-step onboarding flow with carousel pager, stock photos, mock render, onboarding state persistence, root layout routing integration, and accessibility polish.
- 2026-02-16: Code review fixes (1C/4H/3M/3L) — Fixed broken data flow (body photo + garment now threaded to StepSeeTheMagic), added anonymous sign-in on mount, fixed unsafe type casts in StepYourPhoto, added shimmer overlay + cross-fade transition + CTA fade-in, added press scale animation on garment cards, enhanced tests with accessibility and CTA visibility checks. 77 tests pass, 0 fail.

### File List

**New files:**
- `apps/expo/src/components/onboarding/OnboardingFlow.tsx`
- `apps/expo/src/components/onboarding/OnboardingFlow.test.tsx`
- `apps/expo/src/components/onboarding/StepYourPhoto.tsx`
- `apps/expo/src/components/onboarding/StepYourPhoto.test.tsx`
- `apps/expo/src/components/onboarding/StepPickGarment.tsx`
- `apps/expo/src/components/onboarding/StepPickGarment.test.tsx`
- `apps/expo/src/components/onboarding/StepSeeTheMagic.tsx`
- `apps/expo/src/components/onboarding/StepSeeTheMagic.test.tsx`
- `apps/expo/src/app/(onboarding)/index.tsx`
- `apps/expo/src/constants/stockAssets.ts`
- `apps/expo/src/constants/stockAssets.test.ts`
- `apps/expo/src/utils/onboardingState.ts`
- `apps/expo/src/utils/onboardingState.test.ts`
- `apps/expo/src/services/mockRenderService.ts`
- `apps/expo/src/services/mockRenderService.test.ts`
- `apps/expo/assets/stock/body/stock-body-01.png`
- `apps/expo/assets/stock/garments/stock-garment-tops-01.png`
- `apps/expo/assets/stock/garments/stock-garment-tops-02.png`
- `apps/expo/assets/stock/garments/stock-garment-bottoms-01.png`
- `apps/expo/assets/stock/garments/stock-garment-bottoms-02.png`
- `apps/expo/assets/stock/garments/stock-garment-dresses-01.png`
- `apps/expo/assets/stock/garments/stock-garment-dresses-02.png`
- `apps/expo/assets/stock/garments/stock-garment-outerwear-01.png`
- `apps/expo/assets/stock/garments/stock-garment-shoes-01.png`

**Modified files:**
- `apps/expo/src/app/_layout.tsx` — Added onboarding completion check + redirect
- `apps/expo/src/app/(onboarding)/index.tsx` — Replaced empty placeholder with full OnboardingFlow screen
- `apps/expo/test/setup.ts` — Added Bun image loader plugin, mocks for carousel, reanimated, expo-image, expo-image-picker, expo-haptics, async-storage; updated FlatList mock to render items
- `apps/expo/package.json` — Added react-native-reanimated-carousel, react-native-worklets, expo-image, expo-image-picker, expo-haptics, @react-native-async-storage/async-storage
- `pnpm-lock.yaml` — Updated lockfile
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated story status
