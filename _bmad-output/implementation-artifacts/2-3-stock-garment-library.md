# Story 2.3: Stock Garment Library

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to browse stock garments provided by the app,
So that I can try the virtual try-on feature before photographing my own clothes.

## Acceptance Criteria

1. **Given** the app is installed **When** stock garments are loaded **Then** 6-8 curated stock garments are available from pre-bundled assets (assets/stock/garments/) **And** garments cover multiple categories (tops, bottoms, dresses) for variety

2. **Given** the wardrobe grid **When** stock garments are displayed **Then** they appear alongside the user's own garments in the same grid **And** they are browseable by category using the same CategoryPills filter

3. **Given** a stock garment **When** the user taps on it **Then** it behaves identically to a personal garment (same detail flow)

4. **Given** stock garments are pre-bundled **When** the app is offline **Then** stock garments are still available for browsing

## Tasks / Subtasks

- [x] Task 1: Create stock garment assets directory and placeholder images (AC: #1)
  - [x] 1.1 Create directory `apps/expo/assets/stock/garments/`
  - [x] 1.2 Create 8 stock garment cutout PNG images (transparent background): 3 tops, 2 bottoms, 2 dresses, 1 outerwear. Each image should be ~600x720px (matching 1:1.2 aspect ratio). Use simple solid-color silhouette PNGs as dev placeholders (or source free stock photos)
  - [x] 1.3 File naming convention: `stock-{category}-{number}.png` (e.g., `stock-tops-1.png`, `stock-bottoms-1.png`, `stock-dresses-1.png`)

- [x] Task 2: Create stock garments data module (AC: #1, #4)
  - [x] 2.1 Create `apps/expo/src/constants/stockGarments.ts` — defines stock garment metadata array
  - [x] 2.2 Define `StockGarment` type: `{ id: string; category: GarmentCategory; isStock: true; imageSource: ImageSource }` where `imageSource` is the `require()` return type (number in Metro)
  - [x] 2.3 Define `STOCK_GARMENTS` constant array with 8 entries, each with a unique `"stock-"` prefixed id, the correct category, and `require("../../assets/stock/garments/stock-{category}-{n}.png")` for the image source
  - [x] 2.4 Export `StockGarment` type and `STOCK_GARMENTS` array
  - [x] 2.5 Export a helper `getStockGarmentsByCategory(category?: string): StockGarment[]` that filters stock garments by category (or returns all if category is "all" / undefined)
  - [x] 2.6 Write co-located test `stockGarments.test.ts` — test STOCK_GARMENTS has 8 items, test all have unique ids, test categories include tops/bottoms/dresses, test getStockGarmentsByCategory filters correctly, test all ids start with "stock-"

- [x] Task 3: Create unified WardrobeItem type (AC: #2, #3)
  - [x] 3.1 Create `apps/expo/src/types/wardrobe.ts` — shared types for wardrobe items
  - [x] 3.2 Define `WardrobeItem` discriminated union type:
    ```typescript
    type PersonalGarment = RouterOutputs["garment"]["list"][number] & { isStock: false };
    type WardrobeItem = PersonalGarment | StockGarment;
    ```
  - [x] 3.3 Export `WardrobeItem`, `PersonalGarment`, re-export `StockGarment`
  - [x] 3.4 Export type guard `isStockGarment(item: WardrobeItem): item is StockGarment`

- [x] Task 4: Update GarmentCard to support stock garments (AC: #2, #3, #4)
  - [x] 4.1 Update `GarmentCard` props to accept `WardrobeItem` instead of `Garment`
  - [x] 4.2 For stock garments (`isStock === true`): use `source={garment.imageSource}` (local asset number) — no auth headers needed, no server URI
  - [x] 4.3 For personal garments (`isStock === false`): keep existing pattern `source={{ uri: imageUri, headers: { Cookie } }}`
  - [x] 4.4 Accessibility label: stock garments use `"stock ${garment.category} garment"` to distinguish from personal garments in VoiceOver
  - [x] 4.5 Update `GarmentCard.test.tsx` — add tests for stock garment rendering: test renders with local image source, test accessibility label includes "stock", test press callback fires for stock garments

- [x] Task 5: Update WardrobeScreen to merge stock and personal garments (AC: #1, #2, #4)
  - [x] 5.1 Import `STOCK_GARMENTS` and `getStockGarmentsByCategory` from `~/constants/stockGarments`
  - [x] 5.2 Create `useMemo` that merges personal garments (from tRPC query, marked `isStock: false`) with filtered stock garments into a unified `WardrobeItem[]` array. Personal garments appear first, stock garments appended after
  - [x] 5.3 Category filtering: when `selectedCategory` is "all", include all stock garments; when a specific category is selected, filter stock garments by that category (matching the server-side filter behavior)
  - [x] 5.4 Update `renderGarment` callback to pass `WardrobeItem` instead of `Garment`
  - [x] 5.5 Update `keyExtractor` to work with `WardrobeItem` (both have `id: string`)
  - [x] 5.6 Update empty state logic: the "all" empty state should NOT show if stock garments exist (stock garments always ensure at least some content). Category-specific empty state shows only if no personal OR stock garments match
  - [x] 5.7 Update `index.test.tsx` — add tests: test stock garments appear in grid when server returns empty, test stock garments are merged after personal garments, test stock garments filter by category, test stock garments render with WardrobeItem type, test no "empty wardrobe" state when stock garments exist

- [x] Task 6: Typecheck, test, and validation (AC: all)
  - [x] 6.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x] 6.2 Run `turbo test` — all tests pass, 0 regressions from Story 2.2
  - [x] 6.3 Verify stock garments appear in wardrobe grid with placeholder images
  - [x] 6.4 Verify category filtering works for stock garments
  - [x] 6.5 Verify stock garments display offline (no server dependency)
  - [x] 6.6 Verify stock garment tap fires same callback as personal garment
  - [x] 6.7 Verify accessibility labels on stock garment cards

## Dev Notes

### Story Context & Purpose

This story implements **FR11** (user can view stock garments provided by the app). It is the **third story in Epic 2** (Wardrobe Management) and provides the bridge between the empty wardrobe state and the try-on experience.

Stock garments serve two critical purposes:
1. **Immediate value**: New users can browse and (in future stories) try on garments without photographing their own clothes
2. **Onboarding enabler**: Story 5.2 (Three-Step Onboarding Flow) needs stock garments for Step 2 ("Pick a Garment"). The stock garments data module created here will be reused directly in the onboarding flow

**This is a client-side-only story.** No server changes, no database changes, no new tRPC procedures. Stock garments are pre-bundled assets that are merged into the wardrobe grid on the client.

### Architecture Decisions

**Client-Side Stock Garments (NOT Server-Seeded)**

Stock garments are pre-bundled with the app binary, not stored on the server or seeded into the database. Rationale:
- **Offline by design**: Pre-bundled assets are always available, even on first launch with no internet
- **No account required**: Stock garments work before authentication (critical for onboarding in Epic 5)
- **Zero server cost**: No storage, no serving, no database records for stock items
- **Instant availability**: No API call needed to load stock garments — they're already in memory

The trade-off: stock garments don't have server-side records, which means they can't be used for AI try-on renders (which require server-side garment image access) until the try-on pipeline is implemented in Epic 3. When Epic 3 arrives, stock garment images will need to be uploaded to the server on-demand when used for a render. This is a future concern, not a Story 2.3 concern.

[Source: epics.md#Story 2.3 — "pre-bundled assets (assets/stock/garments/)"]
[Source: epics.md#Story 5.2 — "grid of 6-8 curated stock garments" reuses this data]

**Discriminated Union for WardrobeItem**

The wardrobe grid needs to display both personal (server-fetched) and stock (local) garments in the same list. A discriminated union type with `isStock` as the discriminant allows type-safe branching in GarmentCard:

```typescript
// apps/expo/src/types/wardrobe.ts
import type { ImageSource } from "expo-image";
import type { RouterOutputs } from "~/utils/api";
import type { StockGarment } from "~/constants/stockGarments";

type PersonalGarment = RouterOutputs["garment"]["list"][number] & { isStock: false };
type WardrobeItem = PersonalGarment | StockGarment;

function isStockGarment(item: WardrobeItem): item is StockGarment {
  return item.isStock;
}
```

This is the established TypeScript pattern for polymorphic rendering — the same approach used by `useReducer` state machines throughout the project (e.g., `AddState` in Story 2.1).

[Source: architecture.md#Frontend Architecture — React state (useState/useReducer) for local state]

**expo-image with Local Assets**

expo-image accepts both remote URIs and local `require()` assets as the `source` prop:

```typescript
// Remote (personal garments — existing pattern)
<Image source={{ uri: "https://...", headers: { Cookie: "..." } }} />

// Local (stock garments — new pattern)
<Image source={require("../../assets/stock/garments/stock-tops-1.png")} />
```

In Metro bundler, `require()` for images returns a number (asset ID). expo-image's `source` prop accepts `number | ImageSource`. No special handling needed.

[Source: expo-image docs — source prop accepts number (local asset) or object (remote URI)]

### Stock Garments Data Design

```typescript
// apps/expo/src/constants/stockGarments.ts
import type { ImageSource } from "expo-image";

type GarmentCategory = "tops" | "bottoms" | "dresses" | "shoes" | "outerwear";

export interface StockGarment {
  readonly id: string;
  readonly category: GarmentCategory;
  readonly isStock: true;
  readonly imageSource: ImageSource;
}

export const STOCK_GARMENTS: readonly StockGarment[] = [
  { id: "stock-tops-1", category: "tops", isStock: true, imageSource: require("../../../assets/stock/garments/stock-tops-1.png") },
  { id: "stock-tops-2", category: "tops", isStock: true, imageSource: require("../../../assets/stock/garments/stock-tops-2.png") },
  { id: "stock-tops-3", category: "tops", isStock: true, imageSource: require("../../../assets/stock/garments/stock-tops-3.png") },
  { id: "stock-bottoms-1", category: "bottoms", isStock: true, imageSource: require("../../../assets/stock/garments/stock-bottoms-1.png") },
  { id: "stock-bottoms-2", category: "bottoms", isStock: true, imageSource: require("../../../assets/stock/garments/stock-bottoms-2.png") },
  { id: "stock-dresses-1", category: "dresses", isStock: true, imageSource: require("../../../assets/stock/garments/stock-dresses-1.png") },
  { id: "stock-dresses-2", category: "dresses", isStock: true, imageSource: require("../../../assets/stock/garments/stock-dresses-2.png") },
  { id: "stock-outerwear-1", category: "outerwear", isStock: true, imageSource: require("../../../assets/stock/garments/stock-outerwear-1.png") },
] as const;

export function getStockGarmentsByCategory(category?: string): readonly StockGarment[] {
  if (!category || category === "all") return STOCK_GARMENTS;
  return STOCK_GARMENTS.filter((g) => g.category === category);
}
```

**Category distribution (8 garments):**
- Tops: 3 (most common wardrobe category)
- Bottoms: 2
- Dresses: 2
- Outerwear: 1
- Shoes: 0 (excluded — shoes renders are lower quality per architecture notes on supported categories)

**ID convention:** All stock garment IDs start with `"stock-"` prefix. This prevents collisions with cuid2 personal garment IDs and makes it trivial to identify stock items throughout the codebase.

### GarmentCard Update Pattern

The existing `GarmentCard` at `apps/expo/src/components/garment/GarmentCard.tsx` currently accepts only `Garment` (from tRPC output). It constructs the image URI as `${getBaseUrl()}/api/images/${garment.id}` with auth Cookie headers.

**Update to support both types:**

```typescript
import type { WardrobeItem } from "~/types/wardrobe";
import { isStockGarment } from "~/types/wardrobe";

interface GarmentCardProps {
  garment: WardrobeItem;
  onPress: () => void;
  columnWidth: number;
}

export function GarmentCard({ garment, onPress, columnWidth }: GarmentCardProps) {
  // ... animation code unchanged ...

  const imageSource = isStockGarment(garment)
    ? garment.imageSource  // Local asset (number from require)
    : {
        uri: `${getBaseUrl()}/api/images/${garment.id}`,
        headers: cookies ? { Cookie: cookies } : undefined,
      };

  const label = isStockGarment(garment)
    ? `stock ${garment.category} garment`
    : `${garment.category} garment`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      // ... rest unchanged
    >
      <Animated.View style={animatedStyle}>
        <Image
          source={imageSource}
          contentFit="cover"
          recyclingKey={garment.id}
          placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
          transition={200}
          style={{ width: columnWidth, height: itemHeight }}
        />
      </Animated.View>
    </Pressable>
  );
}
```

**Key detail:** `authClient.getCookie()` is only called for personal garments. Stock garments skip the auth call entirely — they're local assets.

[Source: apps/expo/src/components/garment/GarmentCard.tsx — current implementation at lines 1-71]

### WardrobeScreen Merge Logic

The existing `WardrobeScreen` at `apps/expo/src/app/(auth)/(tabs)/index.tsx` fetches garments via `useQuery(trpc.garment.list.queryOptions(...))` and renders them in a LegendList.

**Merge strategy:**

```typescript
import { STOCK_GARMENTS, getStockGarmentsByCategory } from "~/constants/stockGarments";
import type { WardrobeItem } from "~/types/wardrobe";

// Inside WardrobeScreen:
const { data: personalGarments, isLoading, isFetching, isError } = useQuery(
  trpc.garment.list.queryOptions(
    selectedCategory === "all" ? undefined : { category: selectedCategory as GarmentCategory },
  ),
);

// Merge personal + stock garments
const wardrobeItems: WardrobeItem[] = useMemo(() => {
  const personal: WardrobeItem[] = (personalGarments ?? []).map((g) => ({ ...g, isStock: false as const }));
  const stock: WardrobeItem[] = [...getStockGarmentsByCategory(selectedCategory)];
  return [...personal, ...stock]; // Personal first, then stock
}, [personalGarments, selectedCategory]);
```

**Display order:** Personal garments first (ordered by createdAt desc from server), stock garments appended after. This ensures the user's own items always have visual priority.

**Empty state update:** Since stock garments always exist, the "Your wardrobe is waiting" empty state should never appear for the "all" category. However, it CAN appear for a specific category that has neither personal nor stock garments (e.g., filtering by "shoes" which has no stock garments). The category-specific empty state still applies.

[Source: apps/expo/src/app/(auth)/(tabs)/index.tsx — current implementation at lines 1-139]

### Stock Garment Images — Asset Requirements

**Directory:** `apps/expo/assets/stock/garments/`

**Files needed (8 total):**
```
stock-tops-1.png       # ~600x720px, PNG with transparent background
stock-tops-2.png
stock-tops-3.png
stock-bottoms-1.png
stock-bottoms-2.png
stock-dresses-1.png
stock-dresses-2.png
stock-outerwear-1.png
```

**Image specifications:**
- Format: PNG with transparency (garment cutout on transparent background, same as after bg removal)
- Dimensions: ~600x720px (matches 1:1.2 aspect ratio of garment cards)
- Size: Keep under 100KB each to minimize app bundle size (8 images ≈ 800KB total)
- Content: Real or realistic garment silhouettes. For development, solid-color garment shapes are acceptable as placeholders

**For development placeholders:** Create simple colored rectangles with transparency using any image tool. The actual curated stock photos should be sourced before release (free stock photo sites: Unsplash, Pexels — look for flat-lay garment photos, then run through background removal).

**Note:** These same images will be reused in Story 5.2 (onboarding Step 2 "Pick a Garment") — pick images that represent render-quality categories and look good as a selection grid.

[Source: architecture.md#Project Structure — apps/expo/assets/stock/ for stock photos]
[Source: epics.md#Story 5.2 — "grid of 6-8 curated stock garments selected for best render quality"]

### Project Structure Notes

**New files to create:**
```
apps/expo/assets/stock/garments/stock-tops-1.png          # Stock garment image
apps/expo/assets/stock/garments/stock-tops-2.png          # Stock garment image
apps/expo/assets/stock/garments/stock-tops-3.png          # Stock garment image
apps/expo/assets/stock/garments/stock-bottoms-1.png       # Stock garment image
apps/expo/assets/stock/garments/stock-bottoms-2.png       # Stock garment image
apps/expo/assets/stock/garments/stock-dresses-1.png       # Stock garment image
apps/expo/assets/stock/garments/stock-dresses-2.png       # Stock garment image
apps/expo/assets/stock/garments/stock-outerwear-1.png     # Stock garment image
apps/expo/src/constants/stockGarments.ts                   # Stock garment data + types
apps/expo/src/constants/stockGarments.test.ts              # Stock garments tests
apps/expo/src/types/wardrobe.ts                            # Unified WardrobeItem type
```

**Existing files to modify:**
```
apps/expo/src/components/garment/GarmentCard.tsx           # Accept WardrobeItem, support local images
apps/expo/src/components/garment/GarmentCard.test.tsx      # Add stock garment tests
apps/expo/src/app/(auth)/(tabs)/index.tsx                  # Merge stock + personal garments
apps/expo/src/app/(auth)/(tabs)/index.test.tsx             # Add stock garment integration tests
```

**Alignment with architecture:**
- Stock garment constants in `constants/` directory — per code organization rules
- Types in `types/` directory or inline — standard TypeScript patterns
- Asset images in `assets/stock/garments/` — per architecture document structure
- Tests co-located with source files
- All imports from `bun:test`
- No server changes — client-side only implementation

[Source: architecture.md#Structure Patterns — project organization]
[Source: CLAUDE.md#Code Organization — constants in constants/ directory]

### Key Dependencies

**This story depends on:**
- Story 2.1 (garments table + garmentRouter.list + CategoryPills) — DONE
- Story 2.2 (wardrobe grid + GarmentCard + EmptyState + LegendList) — DONE
- Story 1.2 (design system + tab bar) — DONE

**Stories that depend on this story:**
- Story 2.4 (Remove Garment) — stock garments should NOT be removable (no delete option)
- Story 2.5 (Offline Browsing) — stock garments are already offline by design
- Story 3.1 (Garment Detail Bottom Sheet) — stock garments open same detail sheet
- Story 5.2 (Onboarding Step 2 "Pick a Garment") — reuses STOCK_GARMENTS data directly
- Story 5.4 (Replace Example Photos) — stock garments can be hidden from wardrobe

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**stockGarments.test.ts:**
```typescript
// STOCK_GARMENTS has exactly 8 items
// All stock garments have unique ids
// All ids start with "stock-" prefix
// Categories include at least tops, bottoms, and dresses
// All garments have isStock === true
// All garments have a defined imageSource
// getStockGarmentsByCategory("tops") returns only tops
// getStockGarmentsByCategory("bottoms") returns only bottoms
// getStockGarmentsByCategory("all") returns all
// getStockGarmentsByCategory(undefined) returns all
// getStockGarmentsByCategory("shoes") returns empty array (no stock shoes)
```

**GarmentCard.test.tsx updates:**
```typescript
// Existing tests continue to pass for personal garments
// Stock garment: renders with local image source (not server URI)
// Stock garment: accessibility label includes "stock"
// Stock garment: press callback fires correctly
// Stock garment: no auth header call made for local images
```

**WardrobeScreen (index.test.tsx) updates:**
```typescript
// Stock garments appear in grid even when server returns empty list
// Stock garments appear AFTER personal garments in the list
// Stock garments are filtered by selected category
// "Your wardrobe is waiting" empty state does NOT appear when stock garments exist
// Category-specific empty state DOES appear for categories with no stock garments (e.g., shoes)
// Stock garments render with WardrobeItem type compatibility
// Pull-to-refresh does not affect stock garments (they're always present)
```

**Note on testing require():** In `bun:test`, `require()` for image assets returns a number. The test setup may need to mock Metro's asset resolution. If `require("*.png")` fails in tests, mock it in the test/setup.ts preload:
```typescript
// apps/expo/test/setup.ts
mock.module("../../../assets/stock/garments/stock-tops-1.png", () => ({ default: 1 }));
// ... or use a more generic approach
```

Alternatively, test the data module by importing it and checking properties without actually requiring image files (mock the require calls).

### Key Pitfalls to Avoid

1. **DO NOT create stock garments in the database.** They are pre-bundled client-side assets. No DB records, no server storage, no tRPC procedures needed.

2. **DO NOT add a new tRPC route for stock garments.** They are constants defined in the Expo app. The server has no knowledge of stock garments.

3. **DO NOT change the existing `Garment` type from tRPC.** Create a new `WardrobeItem` union type instead. The tRPC output type stays unchanged.

4. **DO NOT call `authClient.getCookie()` for stock garment images.** Stock garments use local `require()` assets — no server request, no auth needed.

5. **DO NOT break the existing GarmentCard interface.** The update must be backward-compatible. All existing tests for personal garment rendering must continue to pass.

6. **DO NOT include shoes in stock garments.** The architecture notes that shoe renders are lower quality. Stock garments should showcase the best categories only.

7. **DO NOT use `useState` for loading state.** The stock garments are synchronous constants — no loading needed. Personal garments still use TanStack Query states.

8. **DO NOT forget the `"stock-"` prefix on all stock garment IDs.** This prevents collisions with cuid2 IDs and enables easy identification.

9. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

10. **DO NOT put stockGarments.ts in `components/`.** It's a data constants file — goes in `constants/`.

11. **DO NOT create a separate `__tests__/` directory.** Co-locate all tests next to source files.

12. **DO NOT hardcode image paths as strings.** Use `require()` so Metro bundler includes them in the app binary and handles resolution.

13. **DO NOT make stock garment images too large.** Target ~600x720px and <100KB each to keep the app bundle small. 8 images at 100KB = 800KB total.

14. **DO NOT forget to handle the case where `personalGarments` is `undefined`** (loading state). Use `personalGarments ?? []` before merging.

### Previous Story Intelligence

**From Story 2.2 (Wardrobe Grid & Category Browsing) — CRITICAL REFERENCE:**

- `GarmentCard` at `apps/expo/src/components/garment/GarmentCard.tsx` — accepts `Garment` type (from tRPC), uses `expo-image` with auth-gated server URL, Reanimated press animation, VoiceOver accessibility. Must be extended to accept `WardrobeItem` union type.
- `WardrobeScreen` at `apps/expo/src/app/(auth)/(tabs)/index.tsx` — fetches garments via `useQuery(trpc.garment.list.queryOptions(...))`, renders in LegendList with 2-column grid, CategoryPills header, pull-to-refresh, empty states. Must be extended to merge stock garments.
- `EmptyState` at `apps/expo/src/components/common/EmptyState.tsx` — used for empty wardrobe and empty category. After this story, the "all" empty state should effectively never appear (stock garments ensure content exists).
- `CategoryPills` at `apps/expo/src/components/garment/CategoryPills.tsx` — unchanged. Stock garments use the same category values.
- `GARMENT_CATEGORIES` defined locally in `index.tsx` (not from `@acme/db/schema` due to server-only constraint). Stock garments reference the same category values.
- LegendList mock exists in `apps/expo/test/setup.ts` — supports data rendering, ListEmptyComponent, ListHeaderComponent.
- Code review pattern: placeholder tests are always caught. Write real behavioral tests from the start.
- Current test count: **257 tests** across all packages (post Story 2.2)

**From Story 2.1 (Add Garment with Photo Capture):**

- `garmentRouter.list` at `packages/api/src/router/garment.ts` — returns personal garments filtered by optional category. Stock garments are NOT in this query result — they're merged client-side.
- `garmentCategory` pgEnum: `["tops", "bottoms", "dresses", "shoes", "outerwear"]` — stock garments must use these exact values.
- `GARMENT_CATEGORIES` exported from `@acme/db/schema` — server-side constant, not available in Expo. Stock garments data file defines its own matching constant.

**From Story 1.2 (Design System):**

- expo-image is the standard image component. Accepts both `number` (local require) and `{ uri, headers }` (remote).
- Tab bar with 3 tabs: Wardrobe (index), Add, Profile — unchanged.

### Git Intelligence

**Recent commits (5):**
1. `65dd633` — fix: Story 2.2 code review — 7 issues resolved (2H/5M), status done
2. `106e6b6` — feat: implement Story 2.2 — Wardrobe Grid & Category Browsing
3. `10c370d` — fix: Story 2.1 code review #3 — placeholder tests rewritten, pgEnum, error handling
4. `9d77bde` — fix: Story 2.1 code review #2 — placeholder tests, scroll, error handling
5. `0c059a0` — docs: update Story 2.1 with code review findings and final status

**Patterns from recent work:**
- Conventional commit messages: `feat:` for implementation, `fix:` for code review
- Code review consistently finds: placeholder tests (write real ones), missing error handling, accessibility gaps
- `spyOn(useQuery)` pattern used for testing WardrobeScreen — will need extension for merged data
- DI pattern for server services, mock.module for third-party only
- All 13/13 packages typecheck clean, 257+ tests pass

**Files recently modified (relevant to this story):**
- `apps/expo/src/components/garment/GarmentCard.tsx` — Created in Story 2.2. Being modified to accept WardrobeItem.
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Created in Story 2.2. Being modified to merge stock garments.
- `apps/expo/test/setup.ts` — Updated in Stories 2.1 and 2.2. May need metro asset mocking for stock images.

### Latest Tech Information

**expo-image v3.0.11 — Local Asset Handling:**
- `source` prop accepts `number` (from `require("./image.png")`) directly
- Metro bundler resolves `require()` for images to a numeric asset ID at build time
- Local assets are cached in the app binary — always available offline, instant display
- `contentFit="cover"` works identically for local and remote sources
- `recyclingKey` should still be set for optimal LegendList recycling (use `garment.id`)
- `placeholder` blurhash is ignored for local assets (they load instantly), but including it is harmless
- `transition` prop still applies (fade-in from placeholder to image)

**TypeScript Discriminated Unions:**
- Use a literal type discriminant (`isStock: true` vs `isStock: false`) for type narrowing
- TypeScript narrows the type automatically in `if (item.isStock)` blocks
- Works with `Array.filter()` using type predicates: `items.filter(isStockGarment)`

**Metro Bundler — Static Image Assets:**
- `require()` paths must be static strings (no dynamic interpolation)
- Supported formats: PNG, JPEG, WebP, GIF, SVG (with expo-svg)
- Images in `assets/` are included in the app binary automatically
- `@2x` and `@3x` suffixes are optional for resolution-specific assets

### References

- [Source: epics.md#Story 2.3] — Story definition and all 4 acceptance criteria
- [Source: prd.md#FR11] — User can view stock garments provided by the app
- [Source: prd.md#FR24] — Stock photos at each onboarding step (reuses stock garments)
- [Source: architecture.md#Frontend Architecture] — expo-image for display, TanStack Query for server state
- [Source: architecture.md#Structure Patterns] — assets/stock/garments/ path, component organization
- [Source: architecture.md#Component Boundaries] — WardrobeGrid owns grid layout
- [Source: ux-design-specification.md#OnboardingFlow Step 2] — "grid of 6-8 curated stock garments"
- [Source: ux-design-specification.md#WardrobeGrid] — Stock garments in same grid as personal
- [Source: ux-design-specification.md#Monetization Model] — Stock garments bridge gap for new users
- [Source: ux-design-specification.md#Journey 2: Morning Ritual] — Wardrobe grid as daily screen
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions
- [Source: CLAUDE.md] — @legendapp/list, expo-image, all critical rules
- [Source: 2-1-add-garment-with-photo-capture.md] — garmentRouter.list, garmentCategory enum, CategoryPills
- [Source: 2-2-wardrobe-grid-and-category-browsing.md] — GarmentCard, WardrobeScreen, EmptyState, testing patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `require()` path in stockGarments.ts: Dev Notes specified `../../../assets/` (3 levels up from `src/constants/`) but correct path is `../../assets/` (2 levels up). This was caught during RED phase when bun couldn't resolve the module.
- Added `[loader] ".png" = "file"` to `bunfig.toml` to allow bun test to handle PNG `require()` calls (Metro-specific behavior not natively supported by bun).

### Completion Notes List

- Implemented all 6 tasks for Story 2.3 (Stock Garment Library) — client-side only, no server changes
- Created 8 dev placeholder garment images (600x720px PNG with transparency, 6-10KB each)
- Created `stockGarments.ts` data module with `StockGarment` type, `STOCK_GARMENTS` constant (8 items), and `getStockGarmentsByCategory()` helper
- Created `WardrobeItem` discriminated union type (`PersonalGarment | StockGarment`) with `isStockGarment()` type guard
- Updated `GarmentCard` to accept `WardrobeItem` — stock garments use local `require()` source (no auth), personal garments use server URI with Cookie headers
- Updated `WardrobeScreen` to merge stock + personal garments via `useMemo` — personal items first, stock appended after. Category filtering applies to both.
- Updated empty state: "Your wardrobe is waiting" no longer appears for "all" category (stock garments always provide content). Category-specific "Nothing here yet" still shows for categories with no stock garments (e.g., shoes).
- Removed unused `useRouter` import from WardrobeScreen (CTA button removed since stock garments prevent empty state)
- All 280 tests pass (0 regressions), 13/13 packages typecheck clean
- 23 new tests added: 12 for stockGarments data module, 3 for GarmentCard stock support, 4 for WardrobeScreen stock integration, 4 existing tests updated

### Change Log

- 2026-02-16: Story 2.3 implemented — Stock Garment Library (client-side pre-bundled assets, WardrobeItem union type, merged grid display)
- 2026-02-16: Code review — 8 issues resolved (0H/5M/3L), status done

### File List

**New files:**
- `apps/expo/assets/stock/garments/stock-tops-1.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-tops-2.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-tops-3.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-bottoms-1.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-bottoms-2.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-dresses-1.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-dresses-2.png` — Stock garment placeholder image
- `apps/expo/assets/stock/garments/stock-outerwear-1.png` — Stock garment placeholder image
- `apps/expo/src/constants/categories.ts` — Shared client-side GarmentCategory type + GARMENT_CATEGORIES constant (code review fix M2/L3)
- `apps/expo/src/constants/stockGarments.ts` — Stock garment data module (types + constants + helper)
- `apps/expo/src/constants/stockGarments.test.ts` — Stock garments unit tests (12 tests)
- `apps/expo/src/types/wardrobe.ts` — Unified WardrobeItem type + type guard

**Modified files:**
- `apps/expo/src/components/garment/GarmentCard.tsx` — Accept WardrobeItem, support local/remote image sources
- `apps/expo/src/components/garment/GarmentCard.test.tsx` — Added stock garment tests (3 new tests)
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — Merge stock + personal garments, updated empty state logic
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — Added stock garment integration tests (4 new, 2 updated)
- `apps/expo/bunfig.toml` — Added PNG file loader for bun test
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status updated
