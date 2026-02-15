# Story 1.2: Design System & App Shell Navigation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the app to have a polished, professional appearance with clear navigation,
So that I can easily move between screens and enjoy a premium experience.

## Acceptance Criteria

1. **Given** the app is launched **When** any screen is viewed **Then** the color system is applied: white (#FFFFFF) background, near-black (#1A1A1A) primary text, surface (#F7F7F7) secondary backgrounds, nude blush (#E8C4B8) accent highlight

2. **Given** the app is launched **When** headlines are displayed **Then** DM Serif Display font renders correctly (bundled in assets/fonts/) **And** body/UI text uses Inter (SF Pro fallback on iOS) **And** type scale follows spec: display 28px, heading 22px, title 17px, body 15px, caption 13px, small 11px

3. **Given** the bottom tab bar **When** visible on screen **Then** 3 tabs are shown: Wardrobe (home icon), Add (+ in black circle), Profile (person icon) **And** active tab shows black icon + label, inactive tabs show gray icon with no label **And** safe area respects iOS home indicator spacing

4. **Given** Expo Router configuration **When** route groups are set up **Then** (auth), (onboarding), and (public) groups exist with proper layout files

5. **Given** the design system components **When** Gluestack UI v3 is themed with NativeWind classes **Then** Button (primary/secondary/ghost), Pressable, Text, Toast, and Spinner components are available **And** primary buttons are black fill 52px height, secondary are white + black border 52px, ghost are text-only 44px **And** all spacing follows the 4px grid

## Tasks / Subtasks

- [x] Task 1: Update Tailwind theme configuration with Wearbloom UX palette (AC: #1)
  - [x] 1.1 Update `tooling/tailwind/index.ts` — replace indigo primary with Wearbloom palette: background (#FFFFFF), surface (#F7F7F7), text-primary (#1A1A1A), text-secondary (#6B6B6B), text-tertiary (#A3A3A3), border (#EBEBEB), accent (#1A1A1A), accent-highlight (#E8C4B8), accent-highlight-soft (#F5EBE7), success (#4CAF82), warning (#E5A940), error (#D45555)
  - [x] 1.2 Update `packages/ui/src/gluestack-config.ts` — replace indigo-based palette with same Wearbloom tokens from 1.1, keep spacing (4px grid: xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48) and borderRadius (sm=4, md=8, lg=12, xl=16, full=9999)
  - [x] 1.3 Update `apps/expo/tailwind.config.ts` if it overrides any theme values — ensure it inherits from base config correctly
  - [x] 1.4 Verify NativeWind classes `bg-primary`, `text-primary`, `bg-surface`, `bg-accent-highlight` resolve to correct hex values

- [x] Task 2: Bundle DM Serif Display font and configure typography (AC: #2)
  - [x] 2.1 Install `@expo-google-fonts/dm-serif-display` and `expo-font` via `pnpm add @expo-google-fonts/dm-serif-display expo-font --filter @acme/expo`
  - [x] 2.2 Load font in root layout (`_layout.tsx`) using `useFonts` hook with `DMSerifDisplay_400Regular`
  - [x] 2.3 Add `expo-splash-screen` prevention during font loading (`SplashScreen.preventAutoHideAsync()` / `hideAsync()`)
  - [x] 2.4 Create typography utility components or NativeWind custom classes for the type scale:
    - `display`: DM Serif Display 28px Regular
    - `heading`: DM Serif Display 22px Regular
    - `title`: Inter 17px Semibold
    - `body`: Inter 15px Regular
    - `caption`: Inter 13px Medium
    - `small`: Inter 11px Semibold
  - [x] 2.5 Add `maxFontSizeMultiplier={1.5}` support for Dynamic Type accessibility
  - [x] 2.6 Verify DM Serif Display renders correctly in a sample headline on screen

- [x] Task 3: Set up Expo Router route groups and tab navigation (AC: #3, #4)
  - [x] 3.1 Restructure `apps/expo/src/app/` directory to create route groups:
    ```
    apps/expo/src/app/
      _layout.tsx               # Root layout (providers, font loading, auth check)
      (auth)/
        _layout.tsx             # Auth guard layout
        (tabs)/
          _layout.tsx           # Bottom tab bar
          index.tsx             # Wardrobe grid (home tab) — placeholder
          add.tsx               # Add garment (+ tab) — placeholder
          profile.tsx           # Profile/settings (user tab) — placeholder
      (onboarding)/
        _layout.tsx             # Onboarding layout (no tabs, no auth)
      (public)/
        _layout.tsx             # Public layout
        paywall.tsx             # Placeholder
        privacy.tsx             # Placeholder
    ```
  - [x] 3.2 Create `(auth)/(tabs)/_layout.tsx` with Expo Router `Tabs` component:
    - 3 tabs: Wardrobe (index), Add (add), Profile (profile)
    - Use `lucide-react-native` icons: `Home` for Wardrobe, `PlusCircle` for Add (or custom black circle +), `User` for Profile
    - Install `lucide-react-native`: `pnpm add lucide-react-native --filter @acme/expo`
    - Active tab: black (#1A1A1A) icon + label text. Inactive: gray (#A3A3A3) icon, no label
    - Tab bar background: white (#FFFFFF) with subtle top border (#EBEBEB)
    - Tab bar height accommodates iOS safe area (home indicator)
    - "+" tab icon slightly different: black filled circle with white + (per UX spec)
  - [x] 3.3 Create root `_layout.tsx` — restructure to wrap with:
    - `QueryClientProvider` (already exists)
    - Font loading with `useFonts` + splash screen management
    - Remove hardcoded `#4c6ef5` header color — replace with `#FFFFFF` background, `#1A1A1A` text
    - Use `Slot` or `Stack` for navigation between route groups
  - [x] 3.4 Create `(auth)/_layout.tsx` — placeholder auth guard that wraps (tabs). For now, always render children (auth will be added in Story 1.3)
  - [x] 3.5 Create `(onboarding)/_layout.tsx` — simple Stack layout with no tab bar, no header
  - [x] 3.6 Create `(public)/_layout.tsx` — simple Stack layout for paywall/privacy screens
  - [x] 3.7 Move current `index.tsx` content into `(auth)/(tabs)/index.tsx` as placeholder wardrobe screen
  - [x] 3.8 Create placeholder `add.tsx` and `profile.tsx` in (tabs) with minimal content
  - [x] 3.9 Verify tab navigation works — tapping each tab shows corresponding screen

- [x] Task 4: Update Button component to match UX specification (AC: #5)
  - [x] 4.1 Update `packages/ui/src/button.tsx` — change variants to match UX spec:
    - **primary**: `bg-[#1A1A1A]` fill, white text, 52px height (`h-[52px]`), full-width, `rounded-xl` (12px)
    - **secondary**: white fill (`bg-white`), 1px black border (`border border-[#1A1A1A]`), black text, 52px height, `rounded-xl`
    - **ghost**: no fill, no border, `text-[#6B6B6B]`, 44px height (`h-[44px]`)
    - Press state: scale 0.97x + opacity 0.9 (use Reanimated if installed, or `active:opacity-90 active:scale-[0.97]`)
    - Disabled state: `opacity-40`, no press animation
    - Loading state: spinner replaces text, button stays same size (no layout shift)
  - [x] 4.2 Update `buttonTextStyle` — primary: white, secondary: black (#1A1A1A), ghost: gray (#6B6B6B)
  - [x] 4.3 Add `isLoading` prop support showing `ActivityIndicator` in place of text
  - [x] 4.4 Ensure `accessible={true}`, `accessibilityRole="button"` on all buttons

- [x] Task 5: Create additional design system components (AC: #5)
  - [x] 5.1 Create `packages/ui/src/text.tsx` — themed Text component with variants matching type scale (display, heading, title, body, caption, small). Display/heading use `fontFamily: 'DMSerifDisplay_400Regular'`, others use Inter/system. Include `maxFontSizeMultiplier={1.5}` by default
  - [x] 5.2 Create `packages/ui/src/toast.tsx` — Toast component using `@gluestack-ui/toast` or custom implementation:
    - 3 variants: success (green #4CAF82 left border), error (red #D45555, 4s duration), info (gray, 3s)
    - Appears at TOP of screen (below status bar)
    - Auto-dismiss: success 2s, error 4s, info 3s
    - Tap to dismiss immediately
    - Slide-in from top animation
  - [x] 5.3 Create `packages/ui/src/spinner.tsx` — Spinner component wrapping ActivityIndicator, styled to match accent color (#1A1A1A)
  - [x] 5.4 Update `packages/ui/src/index.ts` — export all new components (ThemedText, Toast, Spinner)
  - [x] 5.5 Verify all components render correctly in the placeholder wardrobe screen

- [x] Task 6: Apply 4px spacing grid and visual polish (AC: #1, #5)
  - [x] 6.1 Ensure all Tailwind spacing in the app follows 4px grid: p-1 (4px), p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px), p-12 (48px)
  - [x] 6.2 Apply global styles: white background on all screens, no dark mode
  - [x] 6.3 Status bar: dark content (black icons/text) on white background
  - [x] 6.4 Remove any remaining starter boilerplate styling (indigo colors, dark mode conditionals)
  - [x] 6.5 Add `SafeAreaView` wrapping all screen containers using `react-native-safe-area-context`

- [x] Task 7: Verify and validate (AC: #1-#5)
  - [x] 7.1 Typecheck: `pnpm typecheck` passes across all packages
  - [x] 7.2 Lint: `pnpm lint` — pre-existing Node.js v20 incompatibility with ESLint `unstable_native_nodejs_ts_config` flag (not a regression, confirmed by testing before changes)
  - [x] 7.3 Visual verification on Expo: tab bar renders with 3 tabs, colors correct, font loads
  - [x] 7.4 Test navigation: tapping tabs switches screens, route groups are accessible
  - [x] 7.5 Test Button variants: primary (black fill 52px), secondary (white+border 52px), ghost (text-only 44px) all render correctly

## Dev Notes

### Critical Architecture Decisions

**This story establishes the visual identity and navigation foundation.** Every subsequent screen and component will build on these design tokens, typography, and navigation patterns. Getting this wrong means reworking every future story.

### Color Palette — MUST Replace Starter Colors

The current codebase uses an indigo-based palette from Story 1.1 placeholder setup:
- `primary-600: #4c6ef5` (indigo blue)
- `neutral-*` scale (gray)

**Story 1.2 MUST replace this with the Wearbloom UX palette:**

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FFFFFF` | App background — clean, bright, premium |
| `surface` | `#F7F7F7` | Cards, secondary backgrounds, input fields |
| `surface-elevated` | `#FFFFFF` | Bottom sheets, modals (with shadow) |
| `text-primary` | `#1A1A1A` | Primary text |
| `text-secondary` | `#6B6B6B` | Secondary text, labels |
| `text-tertiary` | `#A3A3A3` | Placeholder text (WCAG exempt) |
| `border` | `#EBEBEB` | Dividers, card borders |
| `accent` | `#1A1A1A` | Primary buttons, key CTAs — black = luxury |
| `accent-highlight` | `#E8C4B8` | Selected states, active category pill |
| `accent-highlight-soft` | `#F5EBE7` | Accent backgrounds |
| `success` | `#4CAF82` | Success states |
| `warning` | `#E5A940` | Credit low indicator |
| `error` | `#D45555` | Error states, failed renders |

**Files to update:**
1. `tooling/tailwind/index.ts` — shared Tailwind config (source of truth)
2. `packages/ui/src/gluestack-config.ts` — Gluestack theme tokens (keep in sync)
3. `apps/expo/src/app/_layout.tsx` — remove `#4c6ef5` header color

[Source: ux-design-specification.md#Color System]

### Typography — DM Serif Display + Inter

**DM Serif Display** must be bundled as a custom font. It is NOT available as a system font on iOS.

- Install: `pnpm add @expo-google-fonts/dm-serif-display expo-font --filter @acme/expo`
- Load in root layout using `useFonts` hook
- **Display/heading ONLY** use DM Serif — never for body text
- **Inter** is used for all body/UI text — falls back to SF Pro on iOS (system default)
- Body at 15px (not 16px) — slightly tighter, more refined/fashion feel

**Type scale:**

| Token | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| `display` | 28px | Regular | DM Serif Display | Screen titles ("My Wardrobe", "Try On") |
| `heading` | 22px | Regular | DM Serif Display | Section headers |
| `title` | 17px | Semibold | Inter | Card titles, navigation items |
| `body` | 15px | Regular | Inter | Body text, descriptions |
| `caption` | 13px | Medium | Inter | Labels, category pills, secondary info |
| `small` | 11px | Semibold | Inter | Badges, credit count, metadata |

**Accessibility:** `maxFontSizeMultiplier={1.5}` on all Text components. Display/heading fonts do NOT shrink below default.

[Source: ux-design-specification.md#Typography System]

### Tab Bar — 3 Tabs Only

The bottom tab bar uses Expo Router's `Tabs` component:

| Tab | Label | Icon | Route |
|-----|-------|------|-------|
| Wardrobe | "Wardrobe" | Home (lucide) | `(auth)/(tabs)/index.tsx` |
| Add | "Add" | + in black circle | `(auth)/(tabs)/add.tsx` |
| Profile | "Profile" | User (lucide) | `(auth)/(tabs)/profile.tsx` |

**Styling rules:**
- Active tab: black (#1A1A1A) icon + label text
- Inactive tab: gray (#A3A3A3) icon only, no label
- Tab bar background: white (#FFFFFF) with subtle top border (#EBEBEB)
- "+" tab: slightly elevated/different — black filled circle with white + inside
- Respects iOS safe area (home indicator spacing)
- Height: standard iOS tab bar height (~49px content + safe area)

**Tab bar is hidden during:**
- Full-screen modals (render result)
- Onboarding flow
- Public screens (paywall, privacy)

[Source: ux-design-specification.md#BottomTabBar, epics.md#Story 1.2]

### Route Groups — Expo Router File-Based

The route structure MUST use Expo Router's parenthesized groups:

```
apps/expo/src/app/
  _layout.tsx               # Root: providers, font loading
  (auth)/
    _layout.tsx             # Auth guard (placeholder — always render children for now)
    (tabs)/
      _layout.tsx           # Bottom tab bar
      index.tsx             # Wardrobe (home tab)
      add.tsx               # Add garment
      profile.tsx           # Profile/settings
  (onboarding)/
    _layout.tsx             # No tabs, no header
  (public)/
    _layout.tsx             # No tabs
    paywall.tsx             # Placeholder
    privacy.tsx             # Placeholder
```

**CRITICAL:** Route files live in `apps/expo/src/app/` (with `src/` prefix, NOT `apps/expo/app/`). The project uses `tsconfigPaths` in Expo config to resolve `~/` to `./src/*`.

**Auth guard (Story 1.2):** The `(auth)/_layout.tsx` is a PLACEHOLDER. It wraps children with a `Slot` and renders them unconditionally. Actual auth checking is deferred to Story 1.3.

[Source: architecture.md#Route Structure, project-context.md#Framework-Specific Rules]

### Button Component — UX Spec Update

The current Button component (from Story 1.1) uses indigo-based colors. It MUST be updated:

**Current state:**
- primary: `bg-primary-600` (indigo #4c6ef5), white text
- secondary: `bg-neutral-200`, gray border
- ghost: transparent, `text-primary-600` (indigo)

**Target state (UX spec):**
- primary: `bg-[#1A1A1A]` (black fill), white text, 52px height, full-width, rounded-xl (12px)
- secondary: `bg-white border border-[#1A1A1A]`, black text, 52px height, rounded-xl
- ghost: no fill/border, `text-[#6B6B6B]`, 44px height
- Press: scale 0.97x + opacity 0.9 (100ms spring)
- Disabled: opacity 0.4
- Loading: spinner replaces text, same button size

**Rule:** Maximum ONE primary button per screen. Primary always at bottom (thumb-reachable zone).

[Source: ux-design-specification.md#Button Hierarchy]

### Design System Components to Create

In addition to updating Button, create these minimal components:

1. **ThemedText** — `packages/ui/src/text.tsx`
   - Wraps RN Text with variant support (display, heading, title, body, caption, small)
   - Applies correct font family (DM Serif for display/heading, Inter/system for others)
   - Includes `maxFontSizeMultiplier={1.5}` by default

2. **Toast** — `packages/ui/src/toast.tsx`
   - 3 variants: success (2s auto-dismiss), error (4s), info (3s)
   - Appears at TOP of screen, slides from top
   - White background with colored left border
   - Max 1 visible at a time

3. **Spinner** — `packages/ui/src/spinner.tsx`
   - Wraps ActivityIndicator
   - Black (#1A1A1A) default color

[Source: ux-design-specification.md#Component Strategy]

### Project Structure Notes

- All new component files use PascalCase: `ThemedText.tsx`, `Toast.tsx`, `Spinner.tsx`
- Components go in `packages/ui/src/` (shared design system)
- Route files use camelCase: `index.tsx`, `add.tsx`, `profile.tsx`
- Layout files are always `_layout.tsx`
- Co-located tests if any: `button.test.tsx` next to `button.tsx`
- NO separate `__tests__/` directory

### Spacing Grid

All spacing MUST follow the 4px base grid:

| Tailwind | Value | Usage |
|----------|-------|-------|
| `p-1` / `gap-1` | 4px | Minimal (icon to label) |
| `p-2` / `gap-2` | 8px | Tight (within cards, pill padding) |
| `p-4` / `gap-4` | 16px | Standard (card padding, between elements) |
| `p-6` / `gap-6` | 24px | Section spacing |
| `p-8` / `gap-8` | 32px | Major section breaks |
| `p-12` / `gap-12` | 48px | Screen-level top/bottom margins |

**Grid items:** 2px gutter between wardrobe items (not relevant this story but informational).

[Source: ux-design-specification.md#Spacing & Layout Foundation]

### Accessibility Compliance

- WCAG 2.1 Level AA target
- `#1A1A1A` on `#FFFFFF` = 17.4:1 ratio (exceeds AAA)
- `#6B6B6B` on `#FFFFFF` = 5.7:1 ratio (meets AA)
- All interactive elements: `accessible={true}`, `accessibilityRole`, `accessibilityLabel`
- Touch targets: minimum 44x44px
- Dynamic Type: `maxFontSizeMultiplier={1.5}`
- Portrait-only, no dark mode at MVP

[Source: ux-design-specification.md#Accessibility Strategy]

### Previous Story Intelligence (1.1)

**Key learnings from Story 1.1:**
- NativeWind v4 with Tailwind v3 is working correctly — `className` prop available on RN components
- Gluestack UI v3 is installed: `@gluestack-ui/core@^3.0.12`, `@gluestack-ui/utils@^3.0.15`
- `tva` from `@gluestack-ui/utils/nativewind-utils` works for variant-driven styling
- `cn()` utility available from `@acme/ui` (tailwind-merge)
- TypeScript typecheck passes across all 13 packages
- Root layout at `apps/expo/src/app/_layout.tsx` wraps with `QueryClientProvider`
- `react-native-safe-area-context` is available (used in index.tsx)
- Docker not tested (WSL2) — not relevant to this story
- `expo-splash-screen` is already in Expo plugins list (app.config.ts)

**Code review findings applied:**
- H2: Button rewritten with createButton + tva (correct pattern, keep it)
- M2: Hardcoded pink header → changed to primary-600 (now needs to change to #1A1A1A or white)
- The `@acme/ui` package correctly exports `cn`, `tva`, `VariantProps`, `withStyleContext`, `useStyleContext`

**Files from 1.1 that will be MODIFIED in 1.2:**
- `tooling/tailwind/index.ts` — palette replacement
- `packages/ui/src/gluestack-config.ts` — palette replacement
- `packages/ui/src/button.tsx` — UX spec update
- `packages/ui/src/index.ts` — add new component exports
- `apps/expo/src/app/_layout.tsx` — restructure for route groups + font loading
- `apps/expo/src/app/index.tsx` — move to `(auth)/(tabs)/index.tsx`

**Files from 1.1 that will NOT be modified:**
- `apps/server/` — no changes needed
- `packages/api/` — no changes needed
- `packages/db/` — no changes needed
- `packages/auth/` — no changes needed
- `docker-compose.yml`, `Dockerfile` — no changes needed

### Git Intelligence

**Recent commits (5):**
1. `3a8a2d3` — Fix Story 1.1 code review findings (3H/5M/2L)
2. `2feae92` — Add project context for AI agents
3. `1594d42` — Update architecture docs with Bun runtime and test runner patterns
4. `9d84655` — Fix Dockerfile to use pnpm for dependency installation
5. `b99f26c` — Implement Story 1.1: Initialize monorepo from starter template

**Patterns established:**
- Conventional commit messages (feat:, fix:, chore:)
- Code review → fix cycle
- TypeScript strict compliance across all packages
- NativeWind className styling pattern

### Latest Tech Information

**DM Serif Display:**
- Available via `@expo-google-fonts/dm-serif-display` (Google Fonts package for Expo)
- Free, open-source, bundleable
- Use `useFonts` hook from `expo-font` for loading
- Manage splash screen during loading: `SplashScreen.preventAutoHideAsync()` / `hideAsync()`

**Expo Router 6.x (Expo SDK 54):**
- Route groups: `(auth)`, `(onboarding)`, `(public)` directories with `_layout.tsx`
- Tab navigation: `Tabs` component from `expo-router`
- Each tab has `name`, `options.title`, `options.tabBarIcon`
- Tab visibility controlled per group layout

**Gluestack UI v3:**
- Components available: Button (createButton), Text, Pressable, Toast (createToast), Spinner, ActionSheet, AlertDialog, Modal
- Styled via `tva` from `@gluestack-ui/utils/nativewind-utils`
- `createButton`, `createToast`, etc. factory functions for compound components
- NativeWind v4 integration confirmed working (Story 1.1)

**lucide-react-native:**
- Compatible with React Native 0.81 + Expo SDK 54
- Icons: `Home`, `Plus`, `User`, `PlusCircle`, `CirclePlus`
- Usage: `<Home color="#1A1A1A" size={24} />`

### Key Pitfalls to Avoid

1. **DO NOT keep indigo colors.** Every reference to `#4c6ef5` or `primary-600` (indigo) must be replaced with the Wearbloom UX palette. This includes `tooling/tailwind/index.ts`, `packages/ui/src/gluestack-config.ts`, and `apps/expo/src/app/_layout.tsx`.

2. **DO NOT skip font loading.** DM Serif Display is a custom font that must be loaded asynchronously. The splash screen must stay visible until fonts are ready. Missing this = invisible headlines or fallback fonts.

3. **DO NOT create dark mode support.** The UX spec explicitly states: "Not supported at MVP. The white + black premium palette is the brand identity." Remove any `useColorScheme` conditionals from Story 1.1.

4. **DO NOT use 3-column grid.** The wardrobe grid is always 2 columns at all iPhone sizes (not relevant this story but informational for placeholder).

5. **DO NOT use `expo-router` `Tabs` without proper group nesting.** The tabs MUST be inside `(auth)/(tabs)/` group, not at root level. This ensures tabs are only shown when authenticated.

6. **DO NOT use `useState` for loading states.** TanStack Query states (isLoading, isPending) must be used. This applies to font loading too — use `useFonts` return value, not a custom state.

7. **DO NOT import from `"zod"`.** Always import from `"zod/v4"` per project-context.md.

8. **DO NOT add components at the root of `packages/ui/src/`.** Components organized in flat files for now (button.tsx, text.tsx, etc.) since it's a shared package, but when domain components are added later they go in `apps/expo/src/components/`.

### References

- [Source: ux-design-specification.md#Color System] — Complete color palette with hex values and usage
- [Source: ux-design-specification.md#Typography System] — DM Serif Display + Inter type scale
- [Source: ux-design-specification.md#Spacing & Layout Foundation] — 4px grid, wardrobe grid specs
- [Source: ux-design-specification.md#Design Direction Decision] — Immersive Visual direction
- [Source: ux-design-specification.md#Component Strategy] — All 12 custom components spec
- [Source: ux-design-specification.md#Button Hierarchy] — 3-level button system
- [Source: ux-design-specification.md#Feedback Patterns] — Toast notification specs
- [Source: ux-design-specification.md#Navigation Patterns] — Tab bar, modals, gestures
- [Source: ux-design-specification.md#Accessibility Strategy] — WCAG AA, VoiceOver, Dynamic Type
- [Source: ux-design-specification.md#BottomTabBar] — 3 tabs, styling, safe area
- [Source: architecture.md#Frontend Architecture] — Route structure, component locations
- [Source: architecture.md#Code Organization] — File structure conventions
- [Source: architecture.md#Naming Patterns] — PascalCase components, camelCase routes
- [Source: architecture.md#Structure Patterns] — Co-located tests, bun test patterns
- [Source: epics.md#Story 1.2] — Story definition and acceptance criteria
- [Source: project-context.md#Framework-Specific Rules] — Expo patterns, NativeWind, Gluestack
- [Source: project-context.md#Critical Implementation Rules] — Zod v4, TRPCError, env vars
- [Source: 1-1-initialize-monorepo-from-starter-template.md] — Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- TypeScript error fixed: `useRef()` requires initial arg in React 19 strict types (toast.tsx)
- `@acme/ui` added as dependency to `@acme/expo` (was missing)
- ESLint `pnpm lint` fails across ALL packages due to pre-existing Node.js v20.20.0 incompatibility with `unstable_native_nodejs_ts_config` flag — confirmed same failure before Story 1.2 changes via git stash test

### Completion Notes List

- Replaced indigo palette with Wearbloom UX palette in both Tailwind config and Gluestack config
- Installed and configured DM Serif Display font with splash screen management
- Created route group structure: (auth)/(tabs)/, (onboarding)/, (public)/
- Tab bar with 3 tabs (Wardrobe, Add with black circle icon, Profile) using lucide-react-native
- Updated Button component: primary (black 52px), secondary (white+border 52px), ghost (44px) with isLoading support
- Created ThemedText with 6 variants (display/heading use DM Serif, others use system Inter)
- Created Toast with 3 variants (success/error/info) with slide-in animation and auto-dismiss
- Created Spinner wrapping ActivityIndicator with black default
- Removed all dark mode conditionals and indigo color references
- All screens wrapped with SafeAreaView and bg-background
- StatusBar set to dark style

### File List

**Modified:**
- tooling/tailwind/index.ts — Wearbloom color palette (replaced indigo)
- packages/ui/src/gluestack-config.ts — Wearbloom color tokens (replaced indigo)
- packages/ui/src/button.tsx — UX spec variants (primary/secondary/ghost), isLoading, accessibility
- packages/ui/src/index.ts — Added ThemedText, Spinner, Toast exports
- packages/ui/package.json — Added exports for new components
- apps/expo/src/app/_layout.tsx — Font loading, splash screen, Slot router, ToastProvider, StatusBar dark
- apps/expo/package.json — Added @acme/ui, @expo-google-fonts/dm-serif-display, expo-font, lucide-react-native
- pnpm-lock.yaml — Updated lockfile

**Created:**
- packages/ui/src/text.tsx — ThemedText component (6 variants, DM Serif for display/heading)
- packages/ui/src/spinner.tsx — Spinner component (ActivityIndicator wrapper)
- packages/ui/src/toast.tsx — ToastProvider + showToast (3 variants, animated)
- apps/expo/src/app/(auth)/_layout.tsx — Placeholder auth guard (Slot)
- apps/expo/src/app/(auth)/(tabs)/_layout.tsx — Tab bar (3 tabs, lucide icons)
- apps/expo/src/app/(auth)/(tabs)/index.tsx — Wardrobe placeholder screen
- apps/expo/src/app/(auth)/(tabs)/add.tsx — Add garment placeholder screen
- apps/expo/src/app/(auth)/(tabs)/profile.tsx — Profile placeholder screen
- apps/expo/src/app/(onboarding)/_layout.tsx — Onboarding Stack layout
- apps/expo/src/app/(public)/_layout.tsx — Public Stack layout
- apps/expo/src/app/(public)/paywall.tsx — Paywall placeholder screen
- apps/expo/src/app/(public)/privacy.tsx — Privacy placeholder screen

**Deleted:**
- apps/expo/src/app/index.tsx — Moved to (auth)/(tabs)/index.tsx

## Change Log

- 2026-02-15: Story 1.2 implementation — Design system (Wearbloom palette, DM Serif Display typography, Button/ThemedText/Toast/Spinner components) and app shell navigation (route groups, tab bar with 3 tabs)
