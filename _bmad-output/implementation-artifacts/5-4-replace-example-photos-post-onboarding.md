# Story 5.4: Replace Example Photos Post-Onboarding

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user who onboarded with stock photos,
I want to replace the example body photo and garments with my own,
So that the app reflects my real wardrobe and body.

## Acceptance Criteria

1. **Given** the user onboarded with a stock body photo, **When** they navigate to profile settings, **Then** a prompt encourages them to add their own body photo (FR25), **And** the body avatar management flow (Story 1.5) is available to capture/import their photo.

2. **Given** the user replaces the stock body photo, **When** the new photo is saved, **Then** all future renders use the user's own body photo, **And** previous renders made with the stock photo remain viewable.

3. **Given** stock garments in the wardrobe, **When** the user adds their own garments, **Then** own garments appear alongside stock garments in the grid, **And** the user can use either for try-on renders.

4. **Given** the user wants to remove stock garments, **When** they choose to hide or remove them, **Then** stock garments can be removed from the visible wardrobe, **And** they remain available to re-add if needed.

5. **Given** a user who onboarded with their own photos, **When** they access the main app, **Then** no replacement prompts are shown -- their own photos are already in use.

## Tasks / Subtasks

- [x] Task 1: Persist onboarding body photo source (AC: #1, #5)
  - [x] 1.1 Add `setOnboardingBodyPhotoSource(source: "stock" | "own")` and `getOnboardingBodyPhotoSource()` to `apps/expo/src/utils/onboardingState.ts` (AsyncStorage key: `"onboarding_body_photo_source"`)
  - [x] 1.2 In `apps/expo/src/components/onboarding/StepYourPhoto.tsx`, call `setOnboardingBodyPhotoSource("stock")` when stock photo is selected, `setOnboardingBodyPhotoSource("own")` when user takes/imports their own photo. Call at the moment `onPhotoSelected` fires (not before)
  - [x] 1.3 Write co-located tests for `onboardingState.ts` covering new functions
  - [x] 1.4 Write co-located test for StepYourPhoto verifying source is persisted

- [x] Task 2: Show contextual body photo prompt on profile screen (AC: #1, #5)
  - [x] 2.1 Create `apps/expo/src/hooks/useStockPhotoStatus.ts` hook that returns `{ usedStockBodyPhoto: boolean, isLoading: boolean }` by reading `getOnboardingBodyPhotoSource()` AND checking `trpc.user.getBodyPhoto` (if body photo exists in DB, override to `false` regardless of onboarding source)
  - [x] 2.2 In `apps/expo/src/app/(auth)/(tabs)/profile.tsx`, replace the existing "Add Body Photo" / "Update Body Photo" CTA section with conditional rendering:
    - If `usedStockBodyPhoto === true` AND no body photo in DB: Show prominent `StockPhotoReplacementBanner` with messaging "You're using an example photo" + subtitle "Add your own for more realistic try-ons" + accent-highlighted "Add Your Photo" button (accent color `bg-accent-highlight` text)
    - If `usedStockBodyPhoto === false` AND no body photo in DB: Show standard "Add Body Photo" button (existing behavior, no banner)
    - If body photo exists in DB: Show current avatar + "Update Body Photo" (existing behavior)
  - [x] 2.3 Create `apps/expo/src/components/profile/StockPhotoReplacementBanner.tsx` as a styled banner component with: icon (camera), headline, subtitle, CTA button routing to `/(auth)/body-photo`
  - [x] 2.4 Write co-located tests for `useStockPhotoStatus` hook
  - [x] 2.5 Write co-located tests for `StockPhotoReplacementBanner` component
  - [x] 2.6 Write updated profile screen tests covering all 3 states

- [x] Task 3: Clear stock photo prompt after user uploads own photo (AC: #2)
  - [x] 3.1 In `apps/expo/src/components/profile/BodyPhotoManager.tsx`, on successful upload (`onSuccess` callback), call `setOnboardingBodyPhotoSource("own")` to clear the stock flag
  - [x] 3.2 Verify that `trpc.user.getBodyPhoto` invalidation already happens on upload success (it does -- confirmed in existing code)
  - [x] 3.3 Write test verifying that after upload success, `useStockPhotoStatus` returns `usedStockBodyPhoto: false`

- [x] Task 4: Stock garment visibility management (AC: #4)
  - [x] 4.1 Add `apps/expo/src/utils/stockGarmentPreferences.ts` with:
    - `getHiddenStockGarmentIds(): Promise<string[]>` (reads from AsyncStorage key `"hidden_stock_garments"`, returns JSON-parsed array)
    - `hideStockGarment(id: string): Promise<void>` (adds ID to hidden list)
    - `unhideStockGarment(id: string): Promise<void>` (removes ID from hidden list)
    - `unhideAllStockGarments(): Promise<void>` (clears entire hidden list)
    - `getShowStockGarments(): Promise<boolean>` (reads AsyncStorage key `"show_stock_garments"`, defaults to `true`)
    - `setShowStockGarments(show: boolean): Promise<void>`
  - [x] 4.2 Create `apps/expo/src/hooks/useStockGarmentPreferences.ts` hook wrapping the above with React state (reads on mount, exposes `hiddenIds`, `showStock`, `hideGarment`, `unhideGarment`, `toggleShowStock`)
  - [x] 4.3 Write co-located tests for `stockGarmentPreferences.ts`
  - [x] 4.4 Write co-located tests for `useStockGarmentPreferences` hook

- [x] Task 5: Integrate stock garment hiding into wardrobe UI (AC: #4)
  - [x] 5.1 In `apps/expo/src/app/(auth)/(tabs)/index.tsx` (WardrobeScreen), use `useStockGarmentPreferences` hook to filter stock garments from `wardrobeItems` based on `hiddenIds` and `showStock` flag
  - [x] 5.2 Enable long-press on stock garments in the wardrobe grid. Currently `onLongPress` is `undefined` for stock garments. Change to show a confirmation: "Hide this stock garment?" with "Hide" (primary) and "Cancel" (ghost) buttons via `AlertDialog`
  - [x] 5.3 On "Hide" confirmation, call `hideGarment(item.id)` and remove from displayed list
  - [x] 5.4 Add a "Show stock garments" toggle in the profile screen settings section. When toggled off, all stock garments hidden. When toggled on, all non-individually-hidden stock garments re-appear
  - [x] 5.5 Add a "Restore hidden stock garments" option in profile settings (ghost button, only visible if `hiddenIds.length > 0`). Calls `unhideAllStockGarments()`
  - [x] 5.6 Write updated wardrobe screen tests for stock garment filtering
  - [x] 5.7 Write profile screen tests for stock garment toggle and restore

- [x] Task 6: Accessibility and polish (AC: #1-5)
  - [x] 6.1 `StockPhotoReplacementBanner`: `accessibilityLabel="You're using an example body photo. Tap to add your own."`, `accessibilityRole="button"`
  - [x] 6.2 Stock garment hide confirmation: `AlertDialog` with proper accessibility labels
  - [x] 6.3 "Show stock garments" toggle: `accessibilityLabel="Show stock garments"`, `accessibilityRole="switch"`, `accessibilityState={{ checked: showStock }}`
  - [x] 6.4 Haptic feedback: light haptic on stock garment hide confirmation, light haptic on toggle
  - [x] 6.5 Toast: "Stock garment hidden" (info, 2s) after hiding, "All stock garments restored" (success, 2s) after restore

## Dev Notes

### Architecture Decision: Client-Side Preference Storage

Stock photo status and garment visibility preferences are stored **client-side only** via AsyncStorage. Rationale:
- Stock garments are already client-side constants (not in DB)
- These are UI preferences, not user data requiring server persistence
- Simplest possible implementation with no schema changes
- Consistent with how `onboardingState.ts` already works
- If app data is cleared, stock garments simply reappear (acceptable behavior)

### Body Photo Replacement Flow (AC #2)

Body photo replacement already works end-to-end via Story 1.5:
1. User navigates to `/(auth)/body-photo` route
2. `BodyPhotoManager` component presents camera/gallery options
3. Photo is compressed via `compressImage()`, uploaded via `trpc.user.uploadBodyPhoto`
4. Server atomically replaces body photo record in `body_photos` table
5. `trpc.user.getBodyPhoto` query is invalidated, UI refreshes

**NO new server-side work needed for body photo replacement.** The only addition is clearing the stock photo flag on upload success and showing the contextual prompt.

### Stock Garments Are Alongside Personal (AC #3)

This already works. In `apps/expo/src/app/(auth)/(tabs)/index.tsx` (line ~153):
```typescript
const wardrobeItems = useMemo(() => {
  const personal = (garments ?? []).map(g => ({ ...g, isStock: false as const }));
  return [...personal, ...getStockGarmentsByCategory(selectedCategory)];
}, [garments, selectedCategory]);
```
Personal garments always appear first, stock garments appended. Both work for try-on renders. **No changes needed for AC #3.**

### Previous Renders Remain Viewable (AC #2)

Render results are stored server-side in the `renders` table with their own `resultPath`. They are independent of the current body photo. Replacing the body photo does NOT delete or modify existing render records. **No changes needed** -- this is already the architecture.

### Existing Code to Modify

| File | Change |
|------|--------|
| `apps/expo/src/utils/onboardingState.ts` | Add `setOnboardingBodyPhotoSource()` and `getOnboardingBodyPhotoSource()` |
| `apps/expo/src/components/onboarding/StepYourPhoto.tsx` | Call `setOnboardingBodyPhotoSource()` when photo source is selected |
| `apps/expo/src/app/(auth)/(tabs)/profile.tsx` | Add stock photo banner + stock garment toggle/restore in settings section |
| `apps/expo/src/app/(auth)/(tabs)/index.tsx` | Filter stock garments by hidden IDs and show-stock preference, add long-press on stock garments |
| `apps/expo/src/components/profile/BodyPhotoManager.tsx` | Clear stock flag on upload success |

### New Files to Create

| File | Purpose |
|------|---------|
| `apps/expo/src/hooks/useStockPhotoStatus.ts` | Hook combining onboarding source + DB body photo check |
| `apps/expo/src/hooks/useStockPhotoStatus.test.ts` | Tests for stock photo status hook |
| `apps/expo/src/components/profile/StockPhotoReplacementBanner.tsx` | Styled banner prompting body photo replacement |
| `apps/expo/src/components/profile/StockPhotoReplacementBanner.test.tsx` | Tests for banner component |
| `apps/expo/src/utils/stockGarmentPreferences.ts` | AsyncStorage helpers for stock garment visibility |
| `apps/expo/src/utils/stockGarmentPreferences.test.ts` | Tests for preference helpers |
| `apps/expo/src/hooks/useStockGarmentPreferences.ts` | React hook wrapping stock garment preferences |
| `apps/expo/src/hooks/useStockGarmentPreferences.test.ts` | Tests for preferences hook |

### Existing Code to Reuse

| Existing Code | Use In This Story |
|---|---|
| `@acme/ui` `Button` (primary/ghost variants) | Banner CTA, restore button, hide confirmation |
| `@acme/ui` `ThemedText` (body/caption variants) | Banner messaging text |
| `@acme/ui` `showToast` | Feedback on hide/restore actions |
| `@gluestack-ui/alert-dialog` `AlertDialog` | Stock garment hide confirmation |
| `BodyPhotoManager` from Story 1.5 | Already handles camera/gallery/upload -- no changes to core logic |
| `onboardingState.ts` pattern | Same AsyncStorage pattern for new preferences |
| `isStockGarment()` type guard from `types/wardrobe.ts` | Distinguish stock vs personal in wardrobe grid |
| `getStockGarmentsByCategory()` from `constants/stockGarments.ts` | Existing stock garment data source |
| `authClient.useSession()` | Session check in hooks |

### Previous Story Intelligence

**From Story 5.3 (Account Creation After First Render):**
- `markOnboardingComplete()` is called AFTER successful signup, not before
- `useLocalSearchParams` mock already in `test/setup.ts`
- `authClient.signUp.email()` and Apple Sign-In (ID token flow) patterns established
- TODO markers exist in codebase for forward dependencies (credits, renders migration, body photo association)
- `onboardingState.ts` uses AsyncStorage (not SecureStore) -- follow same pattern for new keys
- Mock patterns: `spyOn` for reversible overrides, `mock.module()` for irreversible module mocks in test setup

**From Story 5.2 (Onboarding Flow):**
- `OnboardingFlow.tsx` uses `react-native-reanimated-carousel` as single-route pager
- `StepYourPhoto.tsx` already tracks `isUsingStock` via local state (`useState`)
- Stock assets defined in `constants/stockAssets.ts` (onboarding) and `constants/stockGarments.ts` (wardrobe)
- Test setup mocks for `expo-image`, `expo-image-picker`, `expo-haptics` already exist

**From Story 5.2 Code Review:**
- 77 tests pass across all onboarding components
- Data flow: body photo URI and garment URI threaded through props

### Git Intelligence (Recent Commits)

| Commit | Key Changes |
|--------|-------------|
| `78d7acb` fix: enforce subscriber entitlement | Credit consumption and subscriber checks |
| `a12e75c` fix(expo): format test files | Test file formatting for CI |
| `0a65a90` fix(expo): resolve test lint violations | ESLint compliance in tests |
| `878b218` fix: resolve 16 MEDIUM and 10 LOW audit findings | Security audit fixes |

**Patterns from recent work:**
- Components in domain subdirectories: `components/profile/`, `components/onboarding/`, `components/garment/`
- Hooks in `apps/expo/src/hooks/` directory
- Utilities in `apps/expo/src/utils/` directory
- `bun:test` imports for all test utilities
- `spyOn` pattern with `afterEach(() => mock.restore())` for cleanup
- `cn()` utility for conditional class merging

### Critical Constraints

1. **Do NOT modify database schema.** No server-side changes needed. All preferences are client-side via AsyncStorage.
2. **Do NOT upload stock photos to the server.** Stock photos remain bundled app assets. Only user-captured photos go to the server via `trpc.user.uploadBodyPhoto`.
3. **Do NOT break existing body photo upload flow.** `BodyPhotoManager` already works perfectly -- only add the stock flag clearing in `onSuccess`.
4. **Do NOT break existing wardrobe grid behavior.** Stock + personal garments must continue displaying together. Only add filtering based on user preference.
5. **AsyncStorage keys must be unique.** Use descriptive keys: `"onboarding_body_photo_source"`, `"hidden_stock_garments"`, `"show_stock_garments"`.
6. **Stock garments use `require()` image sources.** They are Metro-bundled assets, NOT URLs. `GarmentCard` already handles both source types (line 60-68).
7. **`isStockGarment()` type guard already exists** in `types/wardrobe.ts` -- use it, don't recreate.
8. **Zod imports from `"zod/v4"`** -- not `"zod"`.
9. **All `bun:test` imports** -- never vitest/jest.
10. **Tests co-located** with source files (`.test.tsx` next to `.tsx`).
11. **`useState` is acceptable for toggle state** but NOT for loading/error states -- use query/mutation states.
12. **No new dependencies needed** -- all required packages already installed.

### UX Specifications

**StockPhotoReplacementBanner design:**
- Background: `bg-accent-highlight-soft` (`#F5EBE7`) with rounded-xl
- Padding: `p-md` (16px)
- Icon: Camera icon (lucide-react-native `Camera`, 24px, `text-accent-highlight`)
- Headline: "You're using an example photo" (Inter 15px, Semibold, `text-text-primary`)
- Subtitle: "Add your own for more realistic try-ons" (Inter 13px, `text-text-secondary`)
- CTA: "Add Your Photo" button (secondary style: white fill, black border, 44px height)
- Layout: horizontal icon + vertical text stack + CTA below

**Stock garment hide confirmation (AlertDialog):**
- Title: "Hide stock garment?"
- Body: "You can restore it later from Settings."
- Actions: "Cancel" (ghost) + "Hide" (primary)
- No destructive styling (hiding is reversible)

**Profile screen stock garment section:**
- Add to existing settings section (below Subscription, above Legal)
- Toggle: "Show stock garments" with Switch component
- Restore: "Restore hidden garments" ghost button (only visible when items hidden)
- Divider between toggle and restore

### Testing Strategy

**TDD: Write tests first for each task.**

| Component/Hook | Test Scenarios |
|---|---|
| `onboardingState.ts` (new functions) | Set/get body photo source "stock"; set/get body photo source "own"; default returns null when not set |
| `StepYourPhoto.tsx` (modified) | Calls `setOnboardingBodyPhotoSource("stock")` when stock photo used; calls `setOnboardingBodyPhotoSource("own")` when camera/gallery used |
| `useStockPhotoStatus` | Returns `usedStockBodyPhoto: true` when source is "stock" AND no DB photo; returns `false` when source is "own"; returns `false` when DB photo exists regardless of source; returns `false` when source not set (non-onboarded user) |
| `StockPhotoReplacementBanner` | Renders headline, subtitle, CTA; CTA navigates to body-photo route; accessibility labels present |
| `profile.tsx` (modified) | Shows banner when stock + no DB photo; hides banner when own source; hides banner when DB photo exists; shows stock garment toggle; toggle calls setShowStockGarments |
| `stockGarmentPreferences.ts` | Hide/unhide individual garments; unhide all; get/set show stock flag; empty state returns defaults |
| `useStockGarmentPreferences` | Exposes hiddenIds and showStock; hideGarment adds to list; unhideGarment removes from list; toggleShowStock updates flag |
| `index.tsx` (wardrobe, modified) | Filters stock garments by hiddenIds; hides all stock when showStock=false; long-press on stock garment shows AlertDialog; confirm hide removes garment from display |

**Mocking approach:**
- `spyOn` for AsyncStorage methods -- restore in `afterEach`
- Mock `trpc.user.getBodyPhoto` via test wrapper with known return value
- Mock `expo-router` navigation already in test setup
- Mock `expo-haptics` already in test setup
- Use `AlertDialog` mock or test for its render/interaction
- `mock.restore()` in `afterEach` for all spy cleanup

### Cross-Story Dependencies

| Story | Dependency Type | Detail |
|---|---|---|
| Story 1.5 (Body Avatar) | Builds on | `BodyPhotoManager`, `trpc.user.uploadBodyPhoto`, body photo display |
| Story 5.2 (Onboarding Flow) | Builds on | `StepYourPhoto`, `onboardingState`, stock assets |
| Story 5.3 (Account Creation) | Builds on | `markOnboardingComplete()` timing, onboarding state patterns |
| Story 2.3 (Stock Garments) | Builds on | `stockGarments.ts`, `getStockGarmentsByCategory()`, `isStockGarment()` |
| Story 2.2 (Wardrobe Grid) | Builds on | Wardrobe screen, `GarmentCard`, `CategoryPills` |

### Project Structure Notes

- New components in `components/profile/` (existing domain directory)
- New hooks in `hooks/` (existing directory)
- New utilities in `utils/` (existing directory)
- No new directories needed
- No new packages or dependencies required

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4] -- Acceptance criteria
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] -- Route structure, state management
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] -- Body photo auth-gated access
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color System] -- Banner styling tokens
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button Hierarchy] -- CTA styling specs
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns] -- Toast patterns
- [Source: _bmad-output/implementation-artifacts/5-3-account-creation-after-first-render.md] -- Onboarding state patterns, test setup mocks
- [Source: _bmad-output/project-context.md] -- Full project rules and constraints
- [Source: apps/expo/src/utils/onboardingState.ts] -- Existing onboarding state management
- [Source: apps/expo/src/components/onboarding/StepYourPhoto.tsx] -- Stock photo selection logic
- [Source: apps/expo/src/constants/stockGarments.ts] -- Stock garment definitions
- [Source: apps/expo/src/types/wardrobe.ts] -- WardrobeItem type, isStockGarment guard
- [Source: apps/expo/src/app/(auth)/(tabs)/index.tsx] -- Wardrobe screen, stock garment merge logic
- [Source: apps/expo/src/app/(auth)/(tabs)/profile.tsx] -- Profile screen, body photo display
- [Source: apps/expo/src/components/profile/BodyPhotoManager.tsx] -- Body photo upload flow
- [Source: packages/api/src/router/user.ts] -- User router, uploadBodyPhoto procedure
- [Source: packages/db/src/schema.ts] -- bodyPhotos table schema (lines 49-69)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No blocking issues encountered. All tasks implemented cleanly following TDD red-green-refactor cycle.

### Completion Notes List

- Task 1: Added `setOnboardingBodyPhotoSource()` and `getOnboardingBodyPhotoSource()` to `onboardingState.ts`. Wired into `StepYourPhoto.tsx` for all 3 photo selection paths (stock, camera, gallery).
- Task 2: Created `useStockPhotoStatus` hook combining AsyncStorage source check with DB body photo query. Created `StockPhotoReplacementBanner` component. Modified profile screen with conditional rendering for 3 states (stock+no DB, own+no DB, DB photo exists).
- Task 3: Added `setOnboardingBodyPhotoSource("own")` call in `BodyPhotoManager.tsx` `onSuccess` callback. Verified query invalidation already in place.
- Task 4: Created `stockGarmentPreferences.ts` utility with full CRUD for hidden garment IDs and show-stock toggle. Created `useStockGarmentPreferences` hook wrapping the utility with React state.
- Task 5: Integrated stock garment filtering into wardrobe grid via `hiddenIds` and `showStock`. Added long-press → AlertDialog → hide flow for stock garments. Added "Show stock garments" Switch toggle and "Restore hidden garments" button in profile settings.
- Task 6: Verified all accessibility labels and roles. Added haptic feedback on hide confirmation and toggle. Toast messages for hide and restore actions.

### File List

**Modified:**
- `apps/expo/src/utils/onboardingState.ts` — Added body photo source persistence functions
- `apps/expo/src/utils/onboardingState.test.ts` — Added tests for new functions
- `apps/expo/src/components/onboarding/StepYourPhoto.tsx` — Calls `setOnboardingBodyPhotoSource` on photo selection
- `apps/expo/src/components/onboarding/StepYourPhoto.test.tsx` — Added source persistence tests
- `apps/expo/src/app/(auth)/(tabs)/profile.tsx` — Added stock photo banner, stock garment toggle/restore, haptic feedback
- `apps/expo/src/app/(auth)/(tabs)/profile.test.tsx` — Added tests for 3 body photo states, stock garment settings
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Stock garment filtering, long-press hide, AlertDialog, haptics
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — Added stock garment filtering tests, fixed INVALID_CATEGORY test
- `apps/expo/src/components/profile/BodyPhotoManager.tsx` — Clears stock flag on upload success
- `apps/expo/src/components/profile/BodyPhotoManager.test.tsx` — Added stock flag clearing test
- `apps/expo/test/setup.ts` — Added `Switch` to react-native mock

**Created:**
- `apps/expo/src/hooks/useStockPhotoStatus.ts` — Hook combining onboarding source + DB body photo check
- `apps/expo/src/hooks/useStockPhotoStatus.test.ts` — Tests for stock photo status hook
- `apps/expo/src/components/profile/StockPhotoReplacementBanner.tsx` — Banner prompting body photo replacement
- `apps/expo/src/components/profile/StockPhotoReplacementBanner.test.tsx` — Tests for banner component
- `apps/expo/src/utils/stockGarmentPreferences.ts` — AsyncStorage helpers for stock garment visibility
- `apps/expo/src/utils/stockGarmentPreferences.test.ts` — Tests for preference helpers
- `apps/expo/src/hooks/useStockGarmentPreferences.ts` — React hook wrapping stock garment preferences
- `apps/expo/src/hooks/useStockGarmentPreferences.test.ts` — Tests for preferences hook

## Change Log

- 2026-02-17: Implemented Story 5.4 — Replace Example Photos Post-Onboarding. Added body photo source tracking, contextual replacement banner, stock garment hide/show preferences, accessibility, and haptic feedback. All 6 tasks complete, 451 tests pass.
- 2026-02-17: Code Review — Adversarial review found 11 issues (3 HIGH, 5 MEDIUM, 3 LOW). All HIGH and MEDIUM auto-fixed: added missing .catch() on async promise (M1), fixed stale closure in toggleShowStock (M2), added real behavioral tests for useStockPhotoStatus/BodyPhotoManager/useStockGarmentPreferences (H1/H2/M3), renamed misleading test names (H3), fixed accessibilityRole on non-interactive View (M4), prevented UI flash with isLoading guard (M5), fixed deprecated MediaTypeOptions API (L2), fixed unsafe cast in stockGarmentPreferences (L3). Updated banner test assertions. 462 tests pass, 0 fail.
