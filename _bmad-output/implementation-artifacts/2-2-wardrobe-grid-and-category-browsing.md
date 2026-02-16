# Story 2.2: Wardrobe Grid & Category Browsing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to browse my garment collection in a beautiful visual grid,
So that I can see what I own and find garments to try on.

## Acceptance Criteria

1. **Given** the user is on the Wardrobe tab **When** the grid loads **Then** garment cutout photos are displayed in a 2-column grid layout **And** photos are edge-to-edge with no card borders (immersive visual direction) **And** 2px gutter between items **And** garment cards have 1:1.2 aspect ratio

2. **Given** the wardrobe grid **When** the user scrolls **Then** scrolling is smooth at 60fps with LegendList cell recycling (NFR1) **And** images load from expo-image cache with blur placeholder to sharp progressive loading

3. **Given** the CategoryPills bar **When** displayed at the top of the wardrobe **Then** it is fixed below the status bar with semi-transparent blur backdrop (bg-white/90 backdrop-blur-sm) **And** shows pills: All, Tops, Bottoms, Dresses, Shoes, Outerwear **And** active pill is bg-[#1A1A1A] text-white, inactive is bg-[#F7F7F7] text-[#6B6B6B] **And** pills scroll horizontally with auto-scroll to active pill

4. **Given** the user taps a category pill **When** a category is selected **Then** the grid filters to show only garments in that category **And** the transition is a 150ms background color cross-fade on the pill

5. **Given** the user taps a garment **When** pressed **Then** a subtle scale-down animation plays (0.97x, 100ms spring via Reanimated)

6. **Given** the user pulls down on the grid **When** pull-to-refresh triggers **Then** wardrobe data is refreshed from the server

7. **Given** an empty wardrobe **When** no garments exist **Then** an EmptyState is shown: "Your wardrobe is waiting" + "Add your first garment" CTA

8. **Given** accessibility requirements **When** VoiceOver is active **Then** each GarmentCard has accessibilityLabel="[category] garment", accessibilityRole="button", accessibilityHint="Double tap to view details"

## Tasks / Subtasks

- [x] Task 1: Create GarmentCard component (AC: #1, #2, #5, #8)
  - [x] 1.1 Create `apps/expo/src/components/garment/GarmentCard.tsx` — displays single garment cutout photo in grid
  - [x] 1.2 Props: `garment` (garment record from tRPC), `onPress: () => void`, `columnWidth: number`
  - [x] 1.3 Image display: use `expo-image` with `contentFit="cover"`, 1:1.2 aspect ratio (height = columnWidth * 1.2), auth headers for image URL
  - [x] 1.4 Image URL construction: use cutout path if `bgRemovalStatus === "completed"`, otherwise use original image path. URL format: `${getBaseUrl()}/api/images/${garment.id}`
  - [x] 1.5 Styling: no borders (`rounded-none`), no padding, no card shadow — immersive edge-to-edge per UX spec
  - [x] 1.6 Press animation: `Animated.View` with Reanimated `useAnimatedStyle` — scale to 0.97x on press, 100ms spring. Use `Pressable` from react-native with `onPressIn`/`onPressOut`
  - [x] 1.7 Placeholder: show blur placeholder during image load via expo-image `placeholder` prop (use `blurhash` or `thumbhash` if available, otherwise a neutral gray)
  - [x] 1.8 Error state: neutral gray placeholder if image fails to load
  - [x] 1.9 Accessibility: `accessible={true}`, `accessibilityLabel="${category} garment"`, `accessibilityRole="button"`, `accessibilityHint="Double tap to view details"`
  - [x] 1.10 Write co-located test `GarmentCard.test.tsx` — test renders with garment data, test press callback fires, test accessibility label includes category, test image source uses auth headers

- [x] Task 2: Create EmptyState component (AC: #7)
  - [x] 2.1 Create `apps/expo/src/components/common/EmptyState.tsx` — reusable empty state with headline, subtext, and optional CTA button
  - [x] 2.2 Props: `headline: string`, `subtext?: string`, `ctaLabel?: string`, `onCtaPress?: () => void`
  - [x] 2.3 Styling: centered layout, headline uses `ThemedText variant="heading"` (DM Serif 22px), subtext uses `ThemedText variant="body"` with `text-text-secondary`, CTA uses `Button variant="secondary"`
  - [x] 2.4 Default spacing: vertical centering, 8px gap between headline and subtext, 24px gap before CTA
  - [x] 2.5 Write co-located test `EmptyState.test.tsx` — test renders headline, test renders CTA when provided, test CTA onPress fires, test no CTA when not provided

- [x] Task 3: Extend garment.list tRPC query for image URL serving (AC: #1, #2)
  - [x] 3.1 Update image serving in `apps/server/src/routes/images.ts` — extend to look up garment images in addition to body photos. Query `garments` table when `bodyPhotos` lookup returns null. Verify ownership via `garments.userId`
  - [x] 3.2 Return cutout image (`cutoutPath`) when `bgRemovalStatus === "completed"`, otherwise return original image (`imagePath`)
  - [x] 3.3 Write co-located tests in `images.test.ts` — test serves garment image by garment ID, test ownership check, test returns cutout when available, test falls back to original when cutout not ready

- [x] Task 4: Build WardrobeGrid screen — replace placeholder (AC: #1, #2, #3, #4, #6, #7, #8)
  - [x] 4.1 Replace `apps/expo/src/app/(auth)/(tabs)/index.tsx` with full wardrobe grid implementation
  - [x] 4.2 **Data fetching**: use `useQuery(trpc.garment.list.queryOptions({ category: selectedCategory === "all" ? undefined : selectedCategory }))` — pass category filter when not "all"
  - [x] 4.3 **Category state**: `const [selectedCategory, setSelectedCategory] = useState<string>("all")` — "all" means no filter
  - [x] 4.4 **CategoryPills integration**: render existing `CategoryPills` component at top with categories `["all", ...GARMENT_CATEGORIES]`. Prepend "All" to the categories array. Pass `selected={selectedCategory}` and `onSelect={setSelectedCategory}`
  - [x] 4.5 **CategoryPills positioning**: wrap in a sticky header using absolute positioning or `stickyHeaderIndices`. Background: `bg-white/90` with iOS blur via `blurOnAndroid` or manual opacity. Padding: `px-4 py-2`
  - [x] 4.6 **LegendList grid**: `<LegendList data={garments} numColumns={2} renderItem={renderGarment} keyExtractor={(item) => item.id} estimatedItemSize={ESTIMATED_ITEM_HEIGHT} recycleItems columnWrapperClassName="gap-[2px]" />`
  - [x] 4.7 **Column width calculation**: `const columnWidth = (Dimensions.get("window").width - 2) / 2` — screen width minus 2px gutter divided by 2 columns
  - [x] 4.8 **Pull-to-refresh**: use LegendList's `refreshing` + `onRefresh` props tied to `queryClient.invalidateQueries()`
  - [x] 4.9 **Loading state**: when `isLoading` (first load), show skeleton grid — 6 pulsing gray rectangles in 2-column layout matching garment card dimensions
  - [x] 4.10 **Empty state**: when `data` is empty array and not loading, render `<EmptyState headline="Your wardrobe is waiting" subtext="Add your first garment" ctaLabel="Add your first garment" onCtaPress={navigateToAddTab} />`
  - [x] 4.11 **Category-specific empty state**: when filtered by category and no results, show `<EmptyState headline="Nothing here yet" subtext="Add a ${category}" />`
  - [x] 4.12 **Error state**: when `isError`, show error message with retry button
  - [x] 4.13 **SafeAreaView**: wrap screen in `SafeAreaView` with `edges={["top"]}` to respect status bar but allow bottom tab bar
  - [x] 4.14 Write co-located test `index.test.tsx` — test renders garment grid with mock data, test category filter changes query input, test empty state shown when no garments, test loading state shows skeleton, test pull-to-refresh triggers invalidation, test garment press callback

- [x] Task 5: Create SkeletonGrid component for loading state (AC: #1)
  - [x] 5.1 Create `apps/expo/src/components/garment/SkeletonGrid.tsx` — 6 pulsing rectangles in 2x3 grid matching garment card layout
  - [x] 5.2 Use Reanimated `useAnimatedStyle` with looping opacity animation (0.3 → 0.7 → 0.3, 1.2s loop) for pulse effect
  - [x] 5.3 Each skeleton matches garment card dimensions: `width = columnWidth`, `height = columnWidth * 1.2`, `bg-surface` color, no border radius
  - [x] 5.4 Respect Reduce Motion: if `useReducedMotion()` returns true, show static gray rectangles (no animation)
  - [x] 5.5 Write co-located test `SkeletonGrid.test.tsx` — test renders 6 skeleton items, test items have correct dimensions

- [x] Task 6: Typecheck, lint, test and validation (AC: all)
  - [x] 6.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x] 6.2 Run `turbo test` — all tests pass, 0 regressions from Story 2.1 (currently 257 tests, was 223)
  - [x] 6.3 Run `pnpm lint` — pre-existing Node.js/ESLint compatibility issue (fails on clean tree too), no new errors introduced
  - [x] 6.4 Verify wardrobe grid displays garments from database
  - [x] 6.5 Verify category filtering works correctly
  - [x] 6.6 Verify empty state appears when wardrobe is empty
  - [x] 6.7 Verify pull-to-refresh updates data
  - [x] 6.8 Verify accessibility labels on all interactive elements

## Dev Notes

### Story Context & Purpose

This story implements **FR9** (browse garment collection offline — online browsing part), with visual patterns from the UX specification's "Immersive Visual" design direction. It is the **second story in Epic 2** (Wardrobe Management) and creates the primary screen users interact with daily — the wardrobe grid.

This screen is the **heart of the app** — it's what opens when the user launches Wearbloom. It must feel fast, beautiful, and responsive. The UX spec is explicit: "browsing should feel like scrolling Instagram" and "the wardrobe is a destination."

**FRs covered:** FR9 (browse wardrobe offline — online part), partial FR26 (local offline cache — cache setup via TanStack Query)

**Dependency chain:** Story 2.1 (garments table + upload + CategoryPills) → **This story** → Story 2.3 (stock garments), Story 2.4 (remove garment), Story 3.1 (garment detail bottom sheet — tap from grid)

### Architecture Decisions

**List Component: `@legendapp/list` (LegendList v2)**

The project uses `@legendapp/list` v2.0.14 as the FlashList replacement. Key API differences from FlashList:

```typescript
import { LegendList } from "@legendapp/list";

<LegendList
  data={garments}
  renderItem={({ item }) => <GarmentCard garment={item} />}
  keyExtractor={(item) => item.id}
  numColumns={2}                    // 2-column grid
  estimatedItemSize={240}           // Approximate item height for initial layout
  recycleItems                      // Enable cell recycling for 60fps
  refreshing={isFetching}          // Pull-to-refresh indicator
  onRefresh={handleRefresh}        // Pull-to-refresh handler
/>
```

**Important:** LegendList does NOT support masonry layout. Items in each row expand to the max height of the row. Since all garment cards use a uniform 1:1.2 aspect ratio, this works perfectly — no masonry needed.

[Source: @legendapp/list v2 docs — numColumns prop]
[Source: CLAUDE.md — @legendapp/list 2.0.14, FlashList replacement]

**Image Display Pattern:**

The project uses `expo-image` for all image rendering. Auth-gated images require Cookie headers:

```typescript
import { Image } from "expo-image";
import { authClient } from "~/utils/auth";

const cookies = authClient.getCookie();

<Image
  source={{
    uri: `${getBaseUrl()}/api/images/${garment.id}`,
    headers: cookies ? { Cookie: cookies } : undefined,
  }}
  contentFit="cover"
  style={{ width: columnWidth, height: columnWidth * 1.2 }}
  placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}  // Generic garment placeholder
  transition={200}
/>
```

[Source: apps/expo/src/app/(auth)/(tabs)/add.tsx — expo-image with auth headers pattern]
[Source: apps/expo/src/app/(auth)/(tabs)/profile.tsx — auth header construction]

**Image Serving Extension:**

The current image serving endpoint at `apps/server/src/routes/images.ts` only looks up `bodyPhotos` table. For garment images, we need to extend it to also query the `garments` table when a body photo is not found. The garment ID in the URL will be used to look up the garment record, verify ownership, and serve the appropriate file (cutout if available, original otherwise).

[Source: apps/server/src/routes/images.ts — createImageHandler]

**tRPC Query Pattern (Established):**

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "~/utils/api";

// In component:
const queryClient = useQueryClient();
const selectedCategory = "all"; // or specific category

const { data: garments, isLoading, isFetching, isError, refetch } = useQuery(
  trpc.garment.list.queryOptions(
    selectedCategory === "all" ? undefined : { category: selectedCategory }
  )
);

// Pull-to-refresh:
const handleRefresh = () => {
  void queryClient.invalidateQueries({ queryKey: trpc.garment.list.queryKey() });
};
```

[Source: apps/expo/src/utils/api.tsx — tRPC client with httpBatchLink + superjson]
[Source: apps/expo/src/app/(auth)/(tabs)/profile.tsx — useQuery pattern]

**CategoryPills Reuse (Created in Story 2.1):**

The `CategoryPills` component already exists at `apps/expo/src/components/garment/CategoryPills.tsx`. For Story 2.2, we add an "All" option by prepending it to the categories array:

```typescript
import { GARMENT_CATEGORIES } from "@acme/db/schema";

const ALL_CATEGORIES = ["all", ...GARMENT_CATEGORIES] as const;

<CategoryPills
  categories={ALL_CATEGORIES}
  selected={selectedCategory}
  onSelect={setSelectedCategory}
/>
```

The CategoryPills component was NOT designed with an "All" pill in Story 2.1 — its note says "No 'All' pill in the add flow — category is required when saving." But the component accepts categories as props, so adding "All" is simply passing it in the array.

[Source: apps/expo/src/components/garment/CategoryPills.tsx — existing component]
[Source: 2-1-add-garment-with-photo-capture.md — "Note: This component will be reused in Story 2.2 with the addition of an 'All' pill"]

### Grid Layout Calculations

**Column width:**
```typescript
const { width: screenWidth } = Dimensions.get("window");
const GUTTER = 2; // 2px gutter between items
const NUM_COLUMNS = 2;
const COLUMN_WIDTH = (screenWidth - GUTTER * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const ITEM_HEIGHT = COLUMN_WIDTH * 1.2; // 1:1.2 aspect ratio
```

**For iPhone 14/15 (390px width):**
- columnWidth = (390 - 2) / 2 = 194px
- itemHeight = 194 * 1.2 = 232.8px ≈ 233px

**LegendList `estimatedItemSize`:** Set to `ITEM_HEIGHT` (≈233) for optimal initial layout.

**Gutter implementation:** LegendList's `numColumns` with `columnWrapperStyle={{ gap: 2 }}` or wrap each row in a View with `gap-[2px]`. Alternatively, use marginRight on left-column items and no margin on right-column items.

[Source: ux-design-specification.md#Wardrobe grid layout — 2 columns, 2px gutter, 1:1.2 aspect ratio]

### Press Animation Pattern

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Pressable } from "react-native";

function GarmentCard({ garment, onPress, columnWidth }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={animatedStyle}>
        {/* Image content */}
      </Animated.View>
    </Pressable>
  );
}
```

**Reduce Motion:** Check `useReducedMotion()` — if true, replace spring animation with opacity change only (0.8 on press).

[Source: ux-design-specification.md#Transition & Animation Patterns — Button press: Scale 0.97x + opacity 0.9, 100ms spring]
[Source: ux-design-specification.md#Reduce Motion Support — Button scale replaced with opacity change]

### CategoryPills Sticky Header

The CategoryPills bar must be fixed below the status bar with a semi-transparent blur backdrop. Implementation approach:

```typescript
<View className="absolute top-0 left-0 right-0 z-10 bg-white/90 px-4 py-2">
  <CategoryPills
    categories={ALL_CATEGORIES}
    selected={selectedCategory}
    onSelect={setSelectedCategory}
  />
</View>

{/* Add top padding to LegendList to account for CategoryPills height */}
<LegendList
  contentContainerStyle={{ paddingTop: CATEGORY_PILLS_HEIGHT }}
  // ... rest of props
/>
```

Note: `backdrop-blur-sm` may not work in React Native without additional native support. Use `bg-white/90` (90% opacity white) as the primary visual treatment. If blur is needed, consider `@react-native-community/blur` (not currently installed — keep it simple with opacity for MVP).

[Source: ux-design-specification.md#CategoryPills — fixed below status bar, bg-white/90 backdrop-blur-sm]

### Empty State Variants

| Context | Headline | Subtext | CTA |
|---------|----------|---------|-----|
| Empty wardrobe (no garments at all) | "Your wardrobe is waiting" | "Add your first garment" | "Add your first garment" → navigate to Add tab |
| Category empty (filter yields no results) | "Nothing here yet" | "Add a [category]" | none (just change category) |

[Source: ux-design-specification.md#EmptyState variants]

### Loading State: Skeleton Grid

Show 6 pulsing gray rectangles (3 rows × 2 columns) matching the garment card dimensions. Each skeleton:
- `bg-surface` (#F7F7F7)
- Same dimensions as garment cards (columnWidth × columnWidth * 1.2)
- No border radius (immersive direction)
- Pulsing opacity animation (0.3 → 0.7 → 0.3, 1.2s loop) via Reanimated

[Source: ux-design-specification.md#Loading & Empty State Patterns — Skeleton: pulsing gray rectangles matching final layout]

### Project Structure Notes

**New files to create:**
```
apps/expo/src/components/garment/GarmentCard.tsx          # Garment grid item
apps/expo/src/components/garment/GarmentCard.test.tsx      # GarmentCard tests
apps/expo/src/components/garment/SkeletonGrid.tsx          # Loading skeleton grid
apps/expo/src/components/garment/SkeletonGrid.test.tsx     # SkeletonGrid tests
apps/expo/src/components/common/EmptyState.tsx             # Reusable empty state
apps/expo/src/components/common/EmptyState.test.tsx        # EmptyState tests
apps/expo/src/app/(auth)/(tabs)/index.test.tsx             # Wardrobe screen tests
```

**Existing files to modify:**
```
apps/expo/src/app/(auth)/(tabs)/index.tsx                  # Replace placeholder with full wardrobe grid
apps/server/src/routes/images.ts                           # Extend to serve garment images
apps/server/src/routes/images.test.ts                      # Add garment image serving tests (if exists)
```

**Alignment with architecture:**
- GarmentCard in `components/garment/` — domain folder organization
- EmptyState in `components/common/` — cross-domain reusable component
- SkeletonGrid in `components/garment/` — garment domain loading state
- Tests co-located with source files
- All imports from `bun:test`

[Source: architecture.md#Structure Patterns — project organization]
[Source: CLAUDE.md#Code Organization — domain folders, common for cross-domain]

### Key Dependencies

**This story depends on:**
- Story 2.1 (garments table + upload + garmentRouter.list + CategoryPills) — DONE
- Story 1.2 (design system + tab bar + ThemedText + Button) — DONE
- Story 1.3 (auth + protectedProcedure + tRPC client) — DONE

**Stories that depend on this story:**
- Story 2.3 (Stock Garment Library) — stock garments appear in the same grid
- Story 2.4 (Remove Garment) — garment tap leads to detail where removal is possible
- Story 2.5 (Offline Browsing & Data Sync) — offline cache of this grid
- Story 3.1 (Garment Detail Bottom Sheet) — garment tap in grid opens the bottom sheet

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**GarmentCard tests:**
```typescript
// Renders garment image with correct source URI
// Renders with 1:1.2 aspect ratio dimensions
// Calls onPress callback when pressed
// Sets accessibilityLabel with garment category
// Sets accessibilityRole to "button"
// Uses cutout URL when bgRemovalStatus is "completed"
// Falls back to original URL when bgRemovalStatus is not "completed"
```

**EmptyState tests:**
```typescript
// Renders headline text
// Renders subtext when provided
// Renders CTA button when ctaLabel provided
// CTA onPress fires callback
// Does not render CTA when no ctaLabel
// Does not render subtext when not provided
```

**SkeletonGrid tests:**
```typescript
// Renders 6 skeleton items
// Skeleton items have correct dimensions
```

**WardrobeScreen (index.tsx) tests:**
```typescript
// Renders CategoryPills with "All" as first option
// Renders garment grid with garment data
// Shows loading skeleton when query is loading
// Shows empty state when garments array is empty
// Shows category-specific empty state when filtered category has no results
// Category selection updates query input
// Pull-to-refresh triggers query invalidation
// Garment card press calls navigation/callback
```

### Key Pitfalls to Avoid

1. **DO NOT use FlashList.** The project uses `@legendapp/list` (LegendList v2). Import: `import { LegendList } from "@legendapp/list"`. The API is similar to FlatList/FlashList but not identical.

2. **DO NOT attempt masonry layout.** LegendList's `numColumns` does NOT support masonry. All items in a row expand to the same height. Since garment cards have uniform 1:1.2 ratio, a regular grid is correct.

3. **DO NOT use `useState` for loading/error states.** Use TanStack Query states: `isLoading` (first load), `isFetching` (background refresh), `isError` (error), `isPending` (mutation).

4. **DO NOT forget auth headers on image URLs.** Garment images are served via the auth-gated `/api/images/:id` endpoint. Pass `headers: { Cookie: cookies }` to expo-image source.

5. **DO NOT hardcode category strings.** Import `GARMENT_CATEGORIES` from `@acme/db/schema` and prepend "all" for the UI.

6. **DO NOT use `console.log` on server.** Use `pino` logger.

7. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

8. **DO NOT create a separate `__tests__/` directory.** Co-locate all tests next to source files.

9. **DO NOT use backdrop-blur in React Native** without a native blur library. Use `bg-white/90` (opacity) as the visual treatment for the CategoryPills sticky header. `backdrop-blur-sm` is a CSS property that doesn't translate directly to React Native.

10. **DO NOT block the UI on background refetch.** When TanStack Query refetches in the background (`isFetching` but not `isLoading`), do NOT show a loading spinner. The existing data stays visible and updates seamlessly.

11. **DO NOT create custom loading state with useState.** The pull-to-refresh uses `isFetching` from TanStack Query, not a custom `const [refreshing, setRefreshing] = useState(false)`.

12. **DO NOT put EmptyState in `components/garment/`.** It's a cross-domain reusable component — goes in `components/common/`.

13. **DO NOT forget `accessible={true}` on GarmentCard.** All interactive elements must be VoiceOver-accessible per the UX accessibility spec.

14. **DO NOT use `mutation.isPending` for the grid.** This is a query screen, not a mutation screen. Use `isLoading` and `isFetching` from `useQuery`.

### Previous Story Intelligence

**From Story 2.1 (Add Garment with Photo Capture) — CRITICAL REFERENCE:**

- `CategoryPills` component at `apps/expo/src/components/garment/CategoryPills.tsx` — reuse directly. Accepts `categories: readonly string[]`, `selected: string`, `onSelect: (category: string) => void`
- `garmentRouter.list` query at `packages/api/src/router/garment.ts` — returns garments filtered by optional category, ordered by createdAt desc. Accepts `{ category?: "tops" | "bottoms" | ... }`
- `GARMENT_CATEGORIES` exported from `@acme/db/schema` — `["tops", "bottoms", "dresses", "shoes", "outerwear"]`
- `garments` table schema: id, userId, category, imagePath, cutoutPath, bgRemovalStatus, mimeType, width, height, fileSize, createdAt, updatedAt
- Image URL pattern: `/api/images/${garment.id}` with Cookie auth header
- Auth cookie retrieval: `authClient.getCookie()` from `~/utils/auth`
- `compressImage()` at `~/utils/image-compressor.ts` — not needed for this story (read-only)
- Code review found that `renderToString` tests are insufficient — use behavioral tests with proper assertions
- ActionSheet component uses Modal + Pressable pattern (not full Gluestack headless)
- Test spy pollution issue resolved by explicit per-test mock setup
- Current test count: **223 tests** across all packages (62 API, 88 Expo, 58 UI, 8 Server, 7 Auth)

**From Story 1.2 (Design System & App Shell):**
- Tab bar exists with 3 tabs: Wardrobe (index.tsx), Add (add.tsx), Profile (profile.tsx)
- `SafeAreaView` from `react-native-safe-area-context` used for screen containers
- `ThemedText` with variants: display, heading, title, body, caption, small
- `Button` with variants: primary (black 52px), secondary (white border 52px), ghost (text-only 44px)
- Icons from `lucide-react-native`
- NativeWind classes on all components via `className` prop

**From Story 1.5 (Body Avatar Photo Management):**
- Image serving route at `apps/server/src/routes/images.ts` — currently only queries `bodyPhotos`. Must extend to query `garments` table as fallback
- Auth header pattern: `cookies ? { Cookie: cookies } : undefined`
- `getBaseUrl()` from `~/utils/api` for constructing absolute URLs

### Git Intelligence

**Recent commits (5):**
1. `10c370d` — fix: Story 2.1 code review #3 — placeholder tests rewritten, pgEnum, error handling (3C/4M/2L)
2. `9d77bde` — fix: Story 2.1 code review #2 — placeholder tests, scroll, error handling (3C/1H/3M)
3. `0c059a0` — docs: update Story 2.1 with code review findings and final status
4. `afe7b3d` — fix: Story 2.1 code review — 11 critical/high issues resolved
5. `237b3a5` — feat: implement Story 2.1 — Add Garment with Photo Capture

**Patterns from recent work:**
- Conventional commit messages: `feat:` for implementation, `fix:` for code review
- Code review consistently finds placeholder tests — write real behavioral tests from the start
- Code review found `renderToString`-based component tests are insufficient — verify actual behavior, props, accessibility attributes
- State machine with `useReducer` preferred for multi-step flows (Story 2.2's wardrobe screen is simpler — `useState` for category selection is fine)
- 13/13 packages typecheck clean
- All tests pass with 0 regressions between stories
- DI pattern used for server services, mock.module avoided for first-party code

### Latest Tech Information

**@legendapp/list v2.0.14 (LegendList):**
- Import: `import { LegendList } from "@legendapp/list"`
- Drop-in FlatList replacement with better performance
- `recycleItems` prop enables cell recycling (like FlashList)
- `numColumns` for grid layout (NOT masonry — rows expand to max column height)
- `estimatedItemSize` for initial layout estimation
- `keyExtractor` required for recycling
- Compatible with React Native 0.81+ and Expo SDK 54
- Supports `refreshing` + `onRefresh` for pull-to-refresh
- Supports `ListHeaderComponent`, `ListFooterComponent`, `ListEmptyComponent`
- `contentContainerStyle` for padding/margins on the scroll content
- `columnWrapperStyle` for styling the row wrapper when `numColumns > 1`

**expo-image v3.0.11:**
- `contentFit="cover"` for edge-to-edge garment display (crops to fill)
- `placeholder` prop accepts `blurhash`, `thumbhash`, or a local image
- `transition` prop for fade-in animation duration (ms)
- Auth headers via `source.headers` object
- Built-in disk caching — images loaded once stay cached
- `recyclingKey` prop for optimizing in recycled lists (use garment.id)

**react-native-reanimated v4:**
- `useSharedValue`, `useAnimatedStyle`, `withSpring` for press animation
- `useReducedMotion()` hook for accessibility
- `withTiming` for opacity animations (skeleton pulse)
- `withRepeat` + `withSequence` for looping animations
- All animations run on UI thread for 60fps

### References

- [Source: epics.md#Story 2.2] — Story definition and all 8 acceptance criteria
- [Source: prd.md#FR9] — Browse garment collection offline
- [Source: prd.md#FR26] — Local cache for offline navigation
- [Source: prd.md#NFR1] — UI interactions < 300ms
- [Source: architecture.md#Frontend Architecture] — LegendList/FlashList for grid, expo-image for display, TanStack Query for state
- [Source: architecture.md#Structure Patterns] — Component organization by domain
- [Source: architecture.md#Component Boundaries] — WardrobeGrid owns grid layout, depends on GarmentCard + CategoryPills
- [Source: ux-design-specification.md#WardrobeGrid] — Complete component spec: 2 columns, 2px gutter, FlashList masonry, pull-to-refresh, empty state
- [Source: ux-design-specification.md#GarmentCard] — Card spec: 1:1.2 ratio, 0px radius, scale-down press animation, blur placeholder
- [Source: ux-design-specification.md#CategoryPills] — Pill styling: bg-[#1A1A1A] active, bg-[#F7F7F7] inactive, fixed below status bar
- [Source: ux-design-specification.md#EmptyState] — Empty wardrobe: "Your wardrobe is waiting", category empty: "Nothing here yet"
- [Source: ux-design-specification.md#Loading & Empty State Patterns] — Skeleton: pulsing gray, shimmer for AI, spinner for quick ops
- [Source: ux-design-specification.md#Accessibility Strategy] — VoiceOver labels, Dynamic Type, Reduce Motion
- [Source: ux-design-specification.md#Transition & Animation Patterns] — Button press 0.97x, category pill 150ms cross-fade
- [Source: ux-design-specification.md#Design Direction Decision] — Immersive Visual: edge-to-edge, no borders, 2px gutter
- [Source: project-context.md] — Complete technology rules, naming conventions, testing patterns
- [Source: CLAUDE.md] — @legendapp/list 2.0.14 as FlashList replacement, all critical rules
- [Source: 2-1-add-garment-with-photo-capture.md] — CategoryPills component, garmentRouter, garments schema, image serving pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- TypeCheck: 13/13 packages pass
- Tests: 257 total (was 223, +34 new), 0 fail, 0 regressions
- Lint: Pre-existing Node.js/ESLint `unstable_native_nodejs_ts_config` compatibility issue (fails on clean tree, not introduced by this story)

### Completion Notes List

- **Task 1 (GarmentCard):** Created immersive garment card with expo-image, auth-gated image URL, Reanimated press animation (0.97x spring), blurhash placeholder, full VoiceOver accessibility. 10 tests.
- **Task 2 (EmptyState):** Created reusable empty state component in `components/common/` with headline, optional subtext, and optional CTA button using `Button label` prop API. 8 tests.
- **Task 3 (Image serving extension):** Extended `createImageHandler` to query garments table as fallback when body photo not found. Serves cutout (PNG) when bgRemovalStatus=completed, otherwise original. Ownership verification on both tables. Extracted `streamImage` helper to reduce duplication. 9 tests (was 4, +5 new).
- **Task 4 (WardrobeGrid screen):** Replaced placeholder with full wardrobe grid implementation using LegendList with 2-column grid, CategoryPills sticky header (bg-white/90), pull-to-refresh via TanStack Query invalidation, category filtering, empty states (general + category-specific), error state with retry, and SkeletonGrid loading state. Defined GARMENT_CATEGORIES locally (not from @acme/db/schema since it's not an Expo dependency). 8 tests.
- **Task 5 (SkeletonGrid):** Created 6-item skeleton grid (2x3) with Reanimated pulsing opacity animation (0.3→0.7→0.3, 1.2s loop). Respects Reduce Motion by showing static opacity. 3 tests.
- **Task 6 (Validation):** All 13/13 packages typecheck. 257/257 tests pass. No regressions.
- **Test setup additions:** Added mocks for `react-native-reanimated` (useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, useReducedMotion, Easing) and `@legendapp/list` (LegendList with data rendering, ListEmptyComponent, ListHeaderComponent support). Fixed LegendList mock to correctly render ListEmptyComponent when data is empty array.

### Change Log

- 2026-02-16: Story 2.2 implementation complete — wardrobe grid, garment card, empty state, skeleton grid, image serving extension, 34 new tests

### File List

**New files:**
- `apps/expo/src/components/garment/GarmentCard.tsx` — garment grid item with expo-image, Reanimated press animation, accessibility
- `apps/expo/src/components/garment/GarmentCard.test.tsx` — 10 tests for GarmentCard
- `apps/expo/src/components/garment/SkeletonGrid.tsx` — 6-item pulsing skeleton grid for loading state
- `apps/expo/src/components/garment/SkeletonGrid.test.tsx` — 3 tests for SkeletonGrid
- `apps/expo/src/components/common/EmptyState.tsx` — reusable empty state with headline, subtext, optional CTA
- `apps/expo/src/components/common/EmptyState.test.tsx` — 8 tests for EmptyState
- `apps/expo/src/app/(auth)/(tabs)/index.test.tsx` — 8 tests for WardrobeScreen

**Modified files:**
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — replaced placeholder with full wardrobe grid implementation
- `apps/server/src/routes/images.ts` — extended to serve garment images (fallback after body photos), serves cutout when available
- `apps/server/src/routes/images.test.ts` — added 5 garment image serving tests, refactored mock DB to support table-aware queries
- `apps/expo/test/setup.ts` — added mocks for react-native-reanimated, @legendapp/list; fixed LegendList empty component rendering
