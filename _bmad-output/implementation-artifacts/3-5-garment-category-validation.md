# Story 3.5: Garment Category Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to only see garment categories where AI renders work well,
So that I have a good experience and don't waste renders on unsupported categories.

## Acceptance Criteria

1. **Given** the server configuration **When** supported categories are defined **Then** a server-side config determines which garment categories are validated for render quality (FR16) **And** categories can be enabled/disabled without app updates

2. **Given** the active TryOnProvider **When** its supportedCategories are queried **Then** it returns the list of GarmentCategory enums it supports

3. **Given** the garment detail bottom sheet **When** a garment in an unsupported category is viewed **Then** the "Try On" button is disabled **And** a message explains why (e.g., "Try-on not yet available for this category")

4. **Given** a render is requested for an unsupported category **When** the server validates the request **Then** a TRPCError with message INVALID_CATEGORY is returned **And** no credit is consumed

5. **Given** the add garment flow **When** the category picker is displayed **Then** all categories are available for organization purposes **And** unsupported categories are visually marked (e.g., subtle badge "try-on coming soon")

## Tasks / Subtasks

- [x] Task 1: Backend — Add supportedCategories to TryOnProviderContext and add getSupportedCategories query (AC: #1, #2)
  - [x] 1.1 Write failing tests in `packages/api/src/router/tryon.test.ts`:
    - Test: getSupportedCategories returns provider's supported categories
    - Test: getSupportedCategories returns empty array when provider not configured
  - [x] 1.2 Add `supportedCategories` to `TryOnProviderContext` interface in `packages/api/src/trpc.ts`
  - [x] 1.3 Update `createMockTryOnProvider()` in `packages/api/src/router/tryon.test.ts` to include `supportedCategories: ["tops", "bottoms", "dresses"]`
  - [x] 1.4 Add `getSupportedCategories` query to `packages/api/src/router/tryon.ts`:
    - `publicProcedure` (no auth required — category info is non-sensitive)
    - No input needed
    - Returns `ctx.tryOnProvider?.supportedCategories ?? []`
  - [x] 1.5 Tests GREEN

- [x] Task 2: Backend — Add category validation to requestRender (AC: #4)
  - [x] 2.1 Write failing tests in `packages/api/src/router/tryon.test.ts`:
    - Test: requestRender rejects unsupported category with INVALID_CATEGORY error
    - Test: requestRender allows supported category (existing test may cover this — verify with `category: "tops"`)
  - [x] 2.2 Add category validation in `requestRender` procedure after garment fetch (after garment existence check, before render record creation):
    ```typescript
    if (!ctx.tryOnProvider.supportedCategories.includes(garment.category as GarmentCategory)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "INVALID_CATEGORY",
      });
    }
    ```
  - [x] 2.3 Tests GREEN

- [x] Task 3: Frontend — Disable "Try On" button for unsupported categories (AC: #3)
  - [x] 3.1 Write failing tests in `apps/expo/src/components/garment/GarmentDetailSheet.test.tsx`:
    - Test: "Try On" button is disabled when garment category is not in supportedCategories
    - Test: "Try On" button is enabled when garment category is in supportedCategories
    - Test: unsupported message is shown when category is not supported
    - Test: unsupported message is NOT shown when category is supported
  - [x] 3.2 Add `supportedCategories` prop to `GarmentDetailSheetProps` in `GarmentDetailSheet.tsx`:
    - `supportedCategories: readonly string[]`
  - [x] 3.3 Compute `isCategorySupported` from `garment.category` and `supportedCategories`:
    ```typescript
    const isCategorySupported = garment
      ? supportedCategories.includes(garment.category)
      : true;
    ```
  - [x] 3.4 Add `disabled={!isCategorySupported}` to "Try On" Button (line ~164)
  - [x] 3.5 Add unsupported message below category badge when `!isCategorySupported`:
    ```tsx
    {!isCategorySupported && (
      <ThemedText variant="caption" className="mt-2 text-text-secondary">
        Try-on not yet available for this category
      </ThemedText>
    )}
    ```
  - [x] 3.6 Tests GREEN

- [x] Task 4: Frontend — Wire supportedCategories into wardrobe home screen (AC: #3, #4)
  - [x] 4.1 Write failing tests in `apps/expo/src/app/(auth)/(tabs)/index.test.tsx`:
    - Test: GarmentDetailSheet receives supportedCategories prop
    - Test: INVALID_CATEGORY error shows specific toast message
  - [x] 4.2 Add `tryon.getSupportedCategories` query in wardrobe home (`index.tsx`):
    ```typescript
    const { data: supportedCategories = [] } = trpc.tryon.getSupportedCategories.useQuery();
    ```
  - [x] 4.3 Pass `supportedCategories` to `<GarmentDetailSheet>`:
    ```tsx
    <GarmentDetailSheet
      garment={selectedGarment}
      onDismiss={handleSheetDismiss}
      onTryOn={handleTryOn}
      supportedCategories={supportedCategories}
    />
    ```
  - [x] 4.4 Add INVALID_CATEGORY error handling in `requestRenderMutation.onError`:
    ```typescript
    if (error.message === "INVALID_CATEGORY") {
      showToast({ message: "Try-on not available for this category.", variant: "error" });
    }
    ```
  - [x] 4.5 Tests GREEN

- [x] Task 5: Frontend — Mark unsupported categories in add garment flow (AC: #5)
  - [x] 5.1 Write failing tests in `apps/expo/src/components/garment/CategoryPills.test.tsx`:
    - Test: pill for unsupported category shows "coming soon" badge
    - Test: pill for supported category does NOT show badge
    - Test: unsupported pill still clickable (for organization purposes)
  - [x] 5.2 Add optional `unsupportedCategories` prop to `CategoryPillsProps`:
    ```typescript
    unsupportedCategories?: readonly string[];
    ```
  - [x] 5.3 Add visual indicator for unsupported categories in CategoryPills render:
    - Check `unsupportedCategories?.includes(category)` per pill
    - Add subtle text indicator below or beside the category label (e.g., small "No try-on" text, or a subtle opacity reduction)
    - Keep pill fully clickable — unsupported categories are valid for wardrobe organization
  - [x] 5.4 Wire in add.tsx: query `tryon.getSupportedCategories`, compute unsupported list, pass to CategoryPills:
    ```typescript
    const { data: supportedCategories = [] } = trpc.tryon.getSupportedCategories.useQuery();
    const unsupportedCategories = CATEGORIES.filter(c => !supportedCategories.includes(c));
    ```
  - [x] 5.5 Tests GREEN

- [x] Task 6: Typecheck, tests, and validation (AC: all)
  - [x] 6.1 Run `pnpm typecheck` — must pass across all packages (13/13) ✅
  - [x] 6.2 Run `turbo test` — all tests pass, 0 regressions ✅ (286 expo + 130 api + 16 db + 9 server = 441 total)
  - [x] 6.3 Verify: getSupportedCategories returns active provider's categories ✅ (test: "returns provider's supported categories")
  - [x] 6.4 Verify: requestRender rejects unsupported category with INVALID_CATEGORY ✅ (test: "rejects unsupported category with INVALID_CATEGORY error")
  - [x] 6.5 Verify: requestRender allows supported category (no regression) ✅ (test: "allows supported category without rejection" + all existing tests pass with category: "tops")
  - [x] 6.6 Verify: GarmentDetailSheet disables "Try On" for unsupported category ✅ (test: disabled button + disabled accessibility hint)
  - [x] 6.7 Verify: GarmentDetailSheet shows explanatory message for unsupported category ✅ (test: "Try-on not yet available for this category")
  - [x] 6.8 Verify: GarmentDetailSheet enables "Try On" for supported category (no regression) ✅ (test: no disabled attribute + standard hint)
  - [x] 6.9 Verify: wardrobe home handles INVALID_CATEGORY error with toast ✅ (test: "INVALID_CATEGORY error shows specific toast message")
  - [x] 6.10 Verify: add garment CategoryPills marks unsupported categories visually ✅ (test: "pill for unsupported category shows 'No try-on' text")
  - [x] 6.11 Verify: unsupported categories remain selectable in add flow (organization only) ✅ (test: "unsupported pill is still clickable")
  - [x] 6.12 Verify: no credit consumed on INVALID_CATEGORY rejection (no render record created) ✅ (category validation placed BEFORE db.insert — no render record created)

## Dev Notes

### Story Context & Purpose

This story implements **FR16** (System limits available garment categories to those validated for render quality). It is the **category validation story of Epic 3** (AI Virtual Try-On Experience) and the final story in this epic.

**Why this matters:** Each TryOnProvider (FalFashn, FalNanoBanana, GoogleVTO) supports different garment categories. Without validation, users could waste credits on renders that the AI model can't handle well (e.g., shoes on FalFashn). This story adds server-side guardrails AND client-side UX to prevent bad renders before they happen.

**Scope boundaries:**
- **IN scope**: `getSupportedCategories` tRPC query, server-side category validation in `requestRender`, GarmentDetailSheet disabled state, CategoryPills visual marking, INVALID_CATEGORY error handling
- **OUT of scope**: Credit system (Story 4.1), subscription checks (Story 4.2), paywall (Story 4.3), dynamic per-category quality scoring, admin UI for category management
- **Forward-looking**: When Epic 4 adds credit tracking, the INVALID_CATEGORY guard ensures no credit deduction even at the application level (render record is never created).

**Architecture note:** The `supportedCategories` property already exists on the `TryOnProvider` interface and all three implementations. This story wires it through to the client and adds server-side enforcement. Categories are provider-specific, not a global config — switching providers (via `ACTIVE_TRYON_PROVIDER` env var) automatically changes which categories are supported.

[Source: epics.md#Story 3.5 — "Garment Category Validation"]
[Source: prd.md#FR16 — "System limits available garment categories to those validated for render quality"]
[Source: architecture.md#Business Error Codes — "INVALID_CATEGORY: Garment category not supported, No credit consumed"]

### Architecture Decisions

**getSupportedCategories as publicProcedure**

The supported categories query uses `publicProcedure` (no auth required) because:
1. Category support information is non-sensitive — it's effectively app configuration
2. Allows the add garment flow to show category indicators even before auth is fully loaded
3. Minimizes unnecessary auth checks for a read-only config query

Pattern follows existing tRPC query conventions in `garment.list` and `garment.getGarment`.

```typescript
getSupportedCategories: publicProcedure.query(({ ctx }) => {
  return ctx.tryOnProvider?.supportedCategories ?? [];
}),
```

[Source: architecture.md#API Patterns — "publicProcedure (no auth) and protectedProcedure (auth required)"]

**Category Validation Placement in requestRender**

The INVALID_CATEGORY check is placed AFTER the garment existence check but BEFORE the render record creation. This ensures:
1. Garment must exist and belong to user (security check first)
2. Category is validated against provider (business rule second)
3. No orphaned render records are created for invalid categories (no DB write on failure)
4. No credit tracking implications (creditConsumed never set since render never created)

Insertion point: After line ~74 in `tryon.ts` (after garment fetch), before line ~76 (render record creation).

```
requestRender flow:
  1. Validate provider exists ✓ (existing)
  2. Validate body photo exists ✓ (existing)
  3. Validate garment exists + belongs to user ✓ (existing)
  4. Validate category supported by provider ← NEW (Story 3.5)
  5. Create render record (only if all validations pass)
  6. Call provider.submitRender
```

[Source: architecture.md#Communication Patterns — "INVALID_CATEGORY: BAD_REQUEST, No credit consumed"]

**Client-Side Double Validation (Belt + Suspenders)**

The GarmentDetailSheet disables the "Try On" button for unsupported categories AND the server validates in `requestRender`. This is intentional defense-in-depth:
- Client-side: UX improvement — prevent user from attempting an invalid action
- Server-side: Security — prevent bypass via API calls, race conditions, or stale client data

The server validation is the source of truth. The client optimization prevents unnecessary network requests.

**CategoryPills Visual Marking (Not Disabling)**

Unsupported categories in the add garment flow are visually MARKED but NOT disabled. This is a deliberate UX decision:
- All categories remain selectable for wardrobe ORGANIZATION
- The "unsupported" indication is informational — "this category won't support try-on YET"
- Users can still categorize their garments correctly
- When a provider adds support for a new category, no user data migration needed

[Source: epics.md#Story 3.5 AC5 — "all categories are available for organization purposes, unsupported categories are visually marked"]

### Backend Implementation

**TryOnProviderContext Interface Update**

Add `supportedCategories` to the test/context interface to match `TryOnProvider`:

```typescript
// packages/api/src/trpc.ts — ADD to TryOnProviderContext interface
export interface TryOnProviderContext {
  submitRender(...): Promise<{ jobId: string }>;
  getResult(jobId: string): Promise<TryOnResult | null>;
  readonly name: string;
  readonly supportedCategories: readonly string[];  // ADD THIS
}
```

**CRITICAL:** This must be `readonly string[]` (not `GarmentCategory[]`) to avoid circular dependency between `trpc.ts` and `tryOnProvider.ts`. The type is compatible since `GarmentCategory` extends `string`.

**New getSupportedCategories Query**

```typescript
// packages/api/src/router/tryon.ts — ADD new procedure

getSupportedCategories: publicProcedure.query(({ ctx }) => {
  return ctx.tryOnProvider?.supportedCategories ?? [];
}),
```

**Category Validation in requestRender**

```typescript
// packages/api/src/router/tryon.ts — ADD after garment existence check (after line ~74)

// Validate category is supported by active provider
if (
  ctx.tryOnProvider.supportedCategories.length > 0 &&
  !ctx.tryOnProvider.supportedCategories.includes(garment.category)
) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "INVALID_CATEGORY",
  });
}
```

**Why check `supportedCategories.length > 0`:** If a provider reports no supported categories (empty array), we don't want to block all renders. This guards against misconfiguration.

**No new packages to install.** All required infrastructure exists.

[Source: architecture.md#Error Handling — "TRPCError with business codes"]
[Source: project-context.md#Business Error Codes — "INVALID_CATEGORY: BAD_REQUEST, No credit consumed"]

### Frontend Implementation

**No new packages to install.** All required libraries are already installed.

**Files to modify:**

```
packages/api/src/trpc.ts                                  — ADD supportedCategories to TryOnProviderContext
packages/api/src/router/tryon.ts                          — ADD getSupportedCategories query + category validation in requestRender
packages/api/src/router/tryon.test.ts                     — ADD tests for getSupportedCategories + INVALID_CATEGORY
apps/expo/src/components/garment/GarmentDetailSheet.tsx    — ADD supportedCategories prop, disabled button, unsupported message
apps/expo/src/components/garment/GarmentDetailSheet.test.tsx — ADD tests for disabled/enabled button states
apps/expo/src/components/garment/CategoryPills.tsx         — ADD unsupportedCategories prop, visual indicator
apps/expo/src/components/garment/CategoryPills.test.tsx    — ADD tests for unsupported badge
apps/expo/src/app/(auth)/(tabs)/index.tsx                  — ADD getSupportedCategories query, pass to sheet, INVALID_CATEGORY error handling
apps/expo/src/app/(auth)/(tabs)/index.test.tsx             — ADD tests for supportedCategories prop and error handling
apps/expo/src/app/(auth)/(tabs)/add.tsx                    — ADD getSupportedCategories query, compute unsupported, pass to CategoryPills
```

**No new files to create.** All changes are modifications to existing files.

**Component Integration:**

```
Wardrobe Home (index.tsx)
├── trpc.tryon.getSupportedCategories.useQuery() → supportedCategories
├── requestRenderMutation (ADD INVALID_CATEGORY error handling)
└── <GarmentDetailSheet supportedCategories={supportedCategories}> [MODIFIED]
    ├── isCategorySupported = supportedCategories.includes(garment.category)
    ├── <Button disabled={!isCategorySupported}> [MODIFIED]
    └── {!isCategorySupported && <ThemedText>"Try-on not yet available..."</ThemedText>} [NEW]

Add Garment (add.tsx)
├── trpc.tryon.getSupportedCategories.useQuery() → supportedCategories
├── unsupportedCategories = CATEGORIES.filter(c => !supportedCategories.includes(c))
└── <CategoryPills unsupportedCategories={unsupportedCategories}> [MODIFIED]
    └── {isUnsupported && <Text>"No try-on"</Text>} [NEW visual indicator]
```

**GarmentDetailSheet Changes:**

```typescript
// Props — ADD
interface GarmentDetailSheetProps {
  garment: WardrobeItem | null;
  onDismiss: () => void;
  onTryOn: (garmentId: string) => void;
  supportedCategories: readonly string[];  // ADD
}

// Logic — ADD
const isCategorySupported = garment
  ? supportedCategories.includes(garment.category)
  : true;  // default true when no garment selected (sheet closed)

// JSX — MODIFY Button
<Button
  label={isCategorySupported ? "Try On" : "Try On"}
  variant="primary"
  onPress={handleTryOn}
  disabled={!isCategorySupported}  // ADD
  accessibilityHint={
    isCategorySupported
      ? "Double tap to start virtual try-on"
      : "Try-on is not available for this garment category"
  }
/>

// JSX — ADD below category badge
{!isCategorySupported && (
  <ThemedText variant="caption" className="mt-2 text-text-secondary">
    Try-on not yet available for this category
  </ThemedText>
)}
```

**Button disabled styling:** The existing `Button` component in `@acme/ui` handles `disabled` prop with `opacity-40` styling and `accessibilityState={{ disabled: true }}`. No additional work needed.

[Source: packages/ui/src/button.tsx:30-32 — "isDisabled: { true: 'opacity-40' }"]
[Source: packages/ui/src/button.tsx:132 — "isDisabled: disabled || isLoading"]

**CategoryPills Changes:**

```typescript
// Props — ADD
interface CategoryPillsProps {
  categories: readonly string[];
  selected: string;
  onSelect: (category: string) => void;
  unsupportedCategories?: readonly string[];  // ADD (optional)
}

// Logic — ADD inside map
const isUnsupported = unsupportedCategories?.includes(category) ?? false;

// JSX — ADD below pill label
{isUnsupported && (
  <Text className="text-[9px] text-text-tertiary">
    No try-on
  </Text>
)}
```

**Design decision:** The indicator text ("No try-on") is intentionally small and subtle (9px, tertiary color) to not overwhelm the picker. The pill remains fully interactive — the indicator is purely informational.

**Wardrobe Home Error Handling:**

```typescript
// apps/expo/src/app/(auth)/(tabs)/index.tsx — MODIFY requestRenderMutation.onError

onError: (error) => {
  if (error.message === "INVALID_CATEGORY") {
    showToast({ message: "Try-on not available for this category.", variant: "error" });
  } else if (error.message === "RENDER_FAILED") {
    showToast({ message: "Render failed. Try again.", variant: "error" });
  } else {
    showToast({ message: "Something went wrong.", variant: "error" });
  }
},
```

This is a belt-and-suspenders check. The button should be disabled client-side, but if the server rejects (e.g., stale data), the user sees a clear error.

### Existing Code References

| Component | Location | Relevance |
|-----------|----------|-----------|
| TryOnProviderContext | `packages/api/src/trpc.ts:53-67` | **MODIFY** — add supportedCategories property |
| tryon router | `packages/api/src/router/tryon.ts:22-142` | **MODIFY** — add getSupportedCategories query + category validation in requestRender |
| tryon router tests | `packages/api/src/router/tryon.test.ts` | **MODIFY** — add tests, update createMockTryOnProvider |
| GarmentDetailSheet | `apps/expo/src/components/garment/GarmentDetailSheet.tsx:22-167` | **MODIFY** — add supportedCategories prop, disabled button, message |
| GarmentDetailSheet tests | `apps/expo/src/components/garment/GarmentDetailSheet.test.tsx` | **MODIFY** — add disabled/enabled tests |
| CategoryPills | `apps/expo/src/components/garment/CategoryPills.tsx:12-98` | **MODIFY** — add unsupportedCategories prop, visual indicator |
| CategoryPills tests | `apps/expo/src/components/garment/CategoryPills.test.tsx` | **MODIFY** — add unsupported badge tests |
| Wardrobe home | `apps/expo/src/app/(auth)/(tabs)/index.tsx:99-229` | **MODIFY** — add query, pass prop, error handling |
| Wardrobe home tests | `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` | **MODIFY** — add tests |
| Add garment | `apps/expo/src/app/(auth)/(tabs)/add.tsx:29,288-298` | **MODIFY** — add query, compute unsupported, pass to CategoryPills |
| TryOnProvider interface | `packages/api/src/services/tryOnProvider.ts:25-34` | READ — supportedCategories already defined |
| FalFashnProvider | `packages/api/src/services/providers/falFashn.ts:38-44` | READ — supports tops, bottoms, dresses |
| FalNanoBananaProvider | `packages/api/src/services/providers/falNanoBanana.ts:11-17` | READ — supports tops, bottoms, dresses |
| GoogleVTOProvider | `packages/api/src/services/providers/googleVTO.ts:15-21` | READ — supports tops, bottoms, shoes |
| Button component | `packages/ui/src/button.tsx:109-139` | READ — disabled prop with opacity-40 styling |
| Server env | `apps/server/src/env.ts:12-14` | READ — ACTIVE_TRYON_PROVIDER default fal_fashn |
| garment.upload | `packages/api/src/router/garment.ts:34-48` | READ — INVALID_CATEGORY error pattern |
| Category constants | `apps/expo/src/constants/categories.ts:1-22` | READ — GARMENT_CATEGORIES array |
| DB schema | `packages/db/src/schema.ts:69-77` | READ — garmentCategory enum |
| showToast | `packages/ui/src/toast.tsx` | EXISTING — toast notifications |
| test helpers | `packages/api/test/helpers.ts` | EXISTING — mockDbSelect, mockDbInsert patterns |

### Project Structure Notes

**No new files created.** All changes are modifications to existing files across both server and client packages.

**Alignment with architecture:**
- `getSupportedCategories` query in tryon router — matches architecture.md router organization
- Category validation in `requestRender` — enforces FR16 at the API boundary
- GarmentDetailSheet disabled state — follows existing Button disabled pattern
- CategoryPills visual indicator — informational, non-blocking (wardrobe organization preserved)

**Naming conventions:**
- tRPC procedure: camelCase verb.noun (`tryon.getSupportedCategories`)
- Props: camelCase (`supportedCategories`, `unsupportedCategories`)
- Error code: SCREAMING_SNAKE_CASE (`INVALID_CATEGORY`)

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**Testing getSupportedCategories query:**
- Create authenticated caller with mock provider that has `supportedCategories: ["tops", "bottoms", "dresses"]`
- Verify query returns `["tops", "bottoms", "dresses"]`
- Create caller with `tryOnProvider: undefined` → verify returns `[]`

**Testing INVALID_CATEGORY validation:**
- Mock garment with `category: "shoes"`, provider with `supportedCategories: ["tops", "bottoms", "dresses"]`
- Expect rejection with `INVALID_CATEGORY` (TRPCError, code BAD_REQUEST)
- Mock garment with `category: "tops"`, same provider → expect success (no rejection)
- Use existing `mockDbSelect` + `spyOn` pattern from tryon.test.ts

**Testing GarmentDetailSheet disabled button:**
- SSR tests via `renderToStaticMarkup` (existing pattern in this test file)
- Pass `supportedCategories: ["tops", "bottoms"]`, garment `category: "shoes"` → expect `disabled` in HTML
- Pass `supportedCategories: ["tops", "bottoms", "shoes"]`, garment `category: "shoes"` → expect NO `disabled`
- Check unsupported message text present/absent

**Testing CategoryPills unsupported badge:**
- Pass `unsupportedCategories: ["shoes", "outerwear"]` → expect "No try-on" text for those pills
- Pass no `unsupportedCategories` → expect no badge for any pill
- Verify unsupported pills remain clickable (onSelect still fires)

**Testing wardrobe home integration:**
- Mock tRPC proxy to return `supportedCategories` from query
- Verify `GarmentDetailSheet` receives the prop
- Verify INVALID_CATEGORY error handling shows toast

**Mocking patterns to follow:**
- `createMockTryOnProvider()` — UPDATE to include `supportedCategories` property
- `createAuthenticatedCaller()` — already supports custom `tryOnProvider` parameter
- SSR rendering — `renderToStaticMarkup` for component tests (existing GarmentDetailSheet pattern)
- tRPC proxy mock — deep Proxy in `apps/expo/test/setup.ts` (existing pattern)

**Test count estimate:** ~12-15 new tests. Current total: ~426. Expected: ~438-441 across all packages.

### Previous Story Intelligence

**From Story 3.4 (Render Retry, Quality Feedback & Credit Policy) — CRITICAL:**

- Total test count: **~426 tests** across all packages (277 expo + 124 api + 16 db + 9 server)
- `submitFeedback` procedure exists in tryon router (protectedProcedure) — new `getSupportedCategories` follows same file
- `creditConsumed` tracking added to tryOnRenders table — INVALID_CATEGORY prevents render record creation entirely (no creditConsumed concern)
- FeedbackButton component created in `components/tryon/` — confirms domain-based organization pattern
- Code review caught 9 issues (1C/4H/3M/1L) — expect similar thoroughness for this story
- `@happy-dom/global-registrator` added as dev dependency for DOM-based behavioral tests
- Pattern: story implementation commit uses `feat:`, code review fix uses `fix:`

**From Story 3.3 (Render Result & Loading Experience):**
- render/[id].tsx uses `GestureDetector` with `Gesture.Pan()` — no interference from this story
- "Try Again" button calls `requestRenderMutation.mutate({ garmentId })` — will now hit INVALID_CATEGORY check if category unsupported (correct behavior — server rejects)
- StatusBar set to `style="light"` for render view — no change needed

**From Story 3.2 (AI Try-On Render Pipeline):**
- `requestRender` creates render with `status: "pending"` — INVALID_CATEGORY prevents this creation entirely
- Category is already fetched from garment query: `category: garments.category` (line ~66 of tryon.ts)
- Category passed to provider: `{ category: garment.category }` — provider can use this for model-specific behavior
- DI pattern for providers: `createTryOnProvider` factory, injected via tRPC context
- Provider created once at server startup in `apps/server/src/index.ts:50`

**From Story 3.1 (Garment Detail Bottom Sheet):**
- `GarmentDetailSheet` uses snap points 60%/90% — no change needed
- `handleTryOn` callback already checks online status — category check happens BEFORE this (button disabled)
- Category badge pill already displayed below garment photo — unsupported message goes below this badge

**Pattern consistency across all Epic 3 stories:**
- Conventional commits: `feat:` for implementation, `fix:` for code review
- 13/13 packages typecheck clean after every story
- All tests from `bun:test`
- Domain-based component organization
- SSR tests (`renderToStaticMarkup`) for presentational components
- DOM tests (`happy-dom`) for behavioral/interactive components

### Git Intelligence

**Recent commits (10):**
1. `1ec6cbc` — fix: Story 3.4 code review — 9 issues resolved (1C/4H/3M/1L), status done
2. `a8d905f` — feat: implement Story 3.4 — Render Retry, Quality Feedback & Credit Policy
3. `6849649` — fix: Story 3.3 code review — 9 issues resolved (1C/4H/3M/1L), status done
4. `2392383` — fix: Story 3.2 code review — 11 issues resolved (1C/4H/3M/3L), status done
5. `025dff9` — refactor: extract shared test helpers and replace hacky type workarounds
6. `808d6a4` — feat: implement Story 3.2 — AI Try-On Render Pipeline
7. `217aa81` — fix: Story 3.1 code review — 9 issues resolved (3H/3M/3L), status done
8. `92fc6ae` — feat: implement Story 3.1 — Garment Detail Bottom Sheet
9. `5390d3e` — fix: Story 2.5 code review — 2 LOW issues resolved
10. `6019caf` — fix: Story 2.5 code review — 9 issues resolved (5H/4M), status done

**Patterns from recent work:**
- Each Epic 3 story has implementation commit + code review commit
- Code review consistently catches 8-12 issues per story
- Test helper extraction available (commit 025dff9) — reuse `mockDbSelect`, `mockDbInsert`, etc.
- All stories follow TDD: failing tests first, then implementation
- `createAuthenticatedCaller` helper used across all tryon router tests

**Files recently modified (relevant to this story):**
- `packages/api/src/router/tryon.ts` — ADD getSupportedCategories + category validation
- `packages/api/src/router/tryon.test.ts` — ADD tests + update mock factory
- `packages/api/src/trpc.ts` — ADD supportedCategories to context interface
- `apps/expo/src/components/garment/GarmentDetailSheet.tsx` — ADD disabled button + message
- `apps/expo/src/components/garment/CategoryPills.tsx` — ADD unsupported visual indicator
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — ADD query + error handling

### Latest Tech Information

**Provider Categories (verified in codebase):**

| Provider | supportedCategories | Missing |
|----------|-------------------|---------|
| FalFashn (default) | tops, bottoms, dresses | shoes, outerwear |
| FalNanoBanana | tops, bottoms, dresses | shoes, outerwear |
| GoogleVTO | tops, bottoms, shoes | dresses, outerwear |

Active provider default: `fal_fashn` (via `ACTIVE_TRYON_PROVIDER` env var in `apps/server/src/env.ts`)

**Implication for users:** With default FalFashn, garments categorized as "shoes" or "outerwear" will have disabled "Try On" buttons and show "Try-on not yet available for this category" message.

**tRPC v11 query patterns (installed):**
- `publicProcedure.query(({ ctx }) => ...)` — no auth required
- Client: `trpc.tryon.getSupportedCategories.useQuery()` — auto-cached by TanStack Query
- Query is cached client-side, re-fetched on window focus (TanStack Query default behavior)
- Categories don't change at runtime (provider is set at server startup), so caching is optimal

**Button component (verified in codebase):**
- `disabled` prop: `boolean` (optional, default false)
- Disabled styling: `opacity-40` (via tva variant)
- Accessibility: `accessibilityState={{ disabled: true }}` automatically set
- Press handler blocked when disabled (Gluestack isDisabled prop)

### Dependencies

**This story depends on:**
- Story 3.1 (Garment Detail Bottom Sheet) — GarmentDetailSheet component with "Try On" button — DONE
- Story 3.2 (AI Render Pipeline) — tryon router with requestRender, TryOnProvider with supportedCategories — DONE

**Stories that depend on this story:**
- None directly. Epic 3 is complete after this story.
- Story 4.1 (Credit System) benefits from INVALID_CATEGORY guard preventing render record creation for unsupported categories.

### Key Pitfalls to Avoid

1. **DO NOT create a new file for the getSupportedCategories query.** Add it as a new procedure in the existing `tryon.ts` router file — it belongs to the tryon domain.

2. **DO NOT use `protectedProcedure` for getSupportedCategories.** Category support info is non-sensitive and should be available without authentication. Use `publicProcedure`.

3. **DO NOT disable category pills in the add garment flow.** Categories must remain selectable for wardrobe organization. Only ADD a visual indicator — never prevent selection.

4. **DO NOT forget to update `TryOnProviderContext` in `trpc.ts`.** The test/context interface is separate from the `TryOnProvider` service interface. If you don't add `supportedCategories` here, TypeScript will error when accessing `ctx.tryOnProvider.supportedCategories`.

5. **DO NOT forget to update `createMockTryOnProvider()` in tests.** All existing tests will break if the mock doesn't include the new `supportedCategories` property (TypeScript strict mode).

6. **DO NOT create a render record before category validation.** The validation MUST happen before `db.insert(tryOnRenders)` to avoid orphaned records and unnecessary creditConsumed tracking.

7. **DO NOT hardcode supported categories on the client.** Always fetch from server via `getSupportedCategories` query. This ensures "categories can be enabled/disabled without app updates" (AC #1).

8. **DO NOT use `console.log` on the server.** Use `logger.info()` / `logger.error()` from pino.

9. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

10. **DO NOT import test utilities from `"vitest"` or `"@jest/globals"`.** Always `import { ... } from "bun:test"`.

11. **DO NOT use explicit column name strings in Drizzle.** Let `casing: "snake_case"` handle the mapping.

12. **DO NOT use `useState` for the getSupportedCategories loading state.** Use the TanStack Query hook directly — `useQuery()` handles loading/error states.

13. **DO NOT modify existing test assertions for requestRender.** Existing tests use `category: "tops"` which IS supported by the mock provider. They should pass without modification IF the mock includes `supportedCategories`.

14. **DO NOT add a new table or column for this story.** Category support is determined by the provider's `supportedCategories` property — no DB schema changes needed.

15. **DO NOT forget accessibility.** The disabled "Try On" button needs an appropriate `accessibilityHint` explaining why it's disabled. The Button component handles `accessibilityState={{ disabled: true }}` automatically.

### References

- [Source: epics.md#Story 3.5] — Story definition and all 5 original acceptance criteria
- [Source: prd.md#FR16] — "System limits available garment categories to those validated for render quality"
- [Source: architecture.md#TryOnProvider Abstraction] — `supportedCategories: GarmentCategory[]` on interface
- [Source: architecture.md#Business Error Codes] — "INVALID_CATEGORY: BAD_REQUEST, No credit consumed"
- [Source: architecture.md#API Patterns] — publicProcedure vs protectedProcedure
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions
- [Source: CLAUDE.md] — All critical implementation rules
- [Source: 3-4-render-retry-quality-feedback-and-credit-policy.md] — Previous story: ~426 tests, tryon router structure, creditConsumed pattern
- [Source: packages/api/src/services/tryOnProvider.ts:25-34] — TryOnProvider interface with supportedCategories
- [Source: packages/api/src/services/providers/falFashn.ts:38-44] — FalFashn supports tops, bottoms, dresses
- [Source: packages/api/src/services/providers/falNanoBanana.ts:11-17] — FalNanoBanana supports tops, bottoms, dresses
- [Source: packages/api/src/services/providers/googleVTO.ts:15-21] — GoogleVTO supports tops, bottoms, shoes
- [Source: packages/api/src/trpc.ts:53-67] — TryOnProviderContext (needs supportedCategories)
- [Source: packages/api/src/router/tryon.ts:22-142] — requestRender (needs category validation)
- [Source: packages/api/src/router/garment.ts:34-48] — INVALID_CATEGORY error pattern precedent
- [Source: packages/ui/src/button.tsx:30-32,109-139] — Button disabled prop with opacity-40
- [Source: apps/server/src/env.ts:12-14] — ACTIVE_TRYON_PROVIDER env var
- [Source: apps/expo/src/components/garment/GarmentDetailSheet.tsx:22-167] — GarmentDetailSheet (modify)
- [Source: apps/expo/src/components/garment/CategoryPills.tsx:12-98] — CategoryPills (modify)
- [Source: apps/expo/src/app/(auth)/(tabs)/index.tsx:99-229] — Wardrobe home (modify)
- [Source: apps/expo/src/app/(auth)/(tabs)/add.tsx:29,288-298] — Add garment (modify)
- [Source: apps/expo/src/constants/categories.ts:1-22] — GARMENT_CATEGORIES client constant

## Change Log

- 2026-02-16: Implemented Story 3.5 — Garment Category Validation (all 6 tasks, 15 new tests)
- 2026-02-16: Code review — 8 issues found (1H/5M/2L), 6 fixed (1H+5M), 2 deferred (L). Status → done

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Task 1: `TryOnProviderContext` interface extended with `readonly supportedCategories: readonly string[]`. New `getSupportedCategories` publicProcedure added to tryon router. Mock updated.
- Task 2: Category validation added in `requestRender` after garment fetch, before render record creation. INVALID_CATEGORY TRPCError thrown for unsupported categories.
- Task 3: GarmentDetailSheet extended with `supportedCategories` prop. "Try On" button disabled + unsupported message shown when category not in provider's list.
- Task 4: Wardrobe home queries `getSupportedCategories` and passes to GarmentDetailSheet. INVALID_CATEGORY error handling added to requestRender mutation.
- Task 5: CategoryPills extended with optional `unsupportedCategories` prop. "No try-on" text indicator added. Add garment screen queries categories and computes unsupported list.
- Task 6: `pnpm typecheck` 13/13, `turbo test` 441 total (0 failures). All ACs verified.
- Fix: Used `?? []` instead of destructuring default `= []` for `useQuery().data` to handle mock returning `null`.

### Code Review Notes

**Review Date:** 2026-02-16 | **Reviewer:** Claude Opus 4.6 (adversarial)

**Issues Found: 8 (1H / 5M / 2L)**

| # | Severity | File | Issue | Resolution |
|---|----------|------|-------|------------|
| H1 | HIGH | GarmentDetailSheet.tsx, add.tsx | Empty `supportedCategories` disables all try-on on client but allows all on server | Fixed: added `supportedCategories.length === 0` guard on both files |
| M1 | MEDIUM | index.test.tsx | `stubUseQuery` mock returns same data for both `useQuery` calls (garments + supportedCategories) | Fixed: `mockImplementation` with callCount to differentiate calls |
| M2 | MEDIUM | add.test.tsx | No integration tests for Story 3.5 changes in add garment flow | Fixed: added 2 Story 3.5 integration tests |
| M3 | MEDIUM | CategoryPills.tsx | "No try-on" text contrast disappears when pill is active (white bg) | Fixed: conditional `text-white/70` when active |
| M4 | MEDIUM | CategoryPills.tsx | Screen readers don't announce unsupported category status | Fixed: `accessibilityLabel` includes "try-on not available" |
| M5 | MEDIUM | GarmentDetailSheet.test.tsx | Non-null assertion `!` on `buttonMatch` violates ESLint rule | Fixed: optional chaining `?.[0] ?? ""` |
| L1 | LOW | — | Empty supportedCategories semantics documented but confusing | Deferred (documentation only) |
| L2 | LOW | — | Regex-based test assertion fragile | Deferred (low risk) |

**Test Impact:** 286 → 288 tests (+2 new), 0 failures, 0 regressions

### Completion Notes List

- All 5 acceptance criteria satisfied
- 15 new tests added (2 getSupportedCategories + 2 INVALID_CATEGORY + 4 GarmentDetailSheet + 2 WardrobeHome + 3 CategoryPills + 2 validation)
- No new packages installed, no DB schema changes
- Category validation is defense-in-depth: client-side (disabled button) + server-side (TRPCError)
- supportedCategories fetched from server (not hardcoded) — categories can change without app update (AC #1)

### File List

- `packages/api/src/trpc.ts` — Added `supportedCategories` to `TryOnProviderContext` interface
- `packages/api/src/router/tryon.ts` — Added `getSupportedCategories` publicProcedure + category validation in `requestRender`
- `packages/api/src/router/tryon.test.ts` — Added 4 tests (getSupportedCategories x2, INVALID_CATEGORY x2), updated mock
- `apps/expo/src/components/garment/GarmentDetailSheet.tsx` — Added `supportedCategories` prop, disabled button, unsupported message
- `apps/expo/src/components/garment/GarmentDetailSheet.test.tsx` — Added 4 tests for disabled/enabled button and unsupported message
- `apps/expo/src/components/garment/CategoryPills.tsx` — Added `unsupportedCategories` prop and "No try-on" indicator
- `apps/expo/src/components/garment/CategoryPills.test.tsx` — Added 3 tests for unsupported badge and clickability
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Added `getSupportedCategories` query, passed to sheet, INVALID_CATEGORY error handling
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — Added 2 tests for query integration and error handling
- `apps/expo/src/app/(auth)/(tabs)/add.tsx` — Added `getSupportedCategories` query, computed unsupported list, passed to CategoryPills
