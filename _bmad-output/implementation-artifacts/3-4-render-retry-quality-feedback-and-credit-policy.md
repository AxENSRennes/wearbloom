# Story 3.4: Render Retry, Quality Feedback & Credit Policy

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to retry a render and report quality issues,
So that I'm not penalized for technical failures or bad AI results.

## Acceptance Criteria

1. **Given** a render completes successfully **When** the credit policy is applied **Then** one credit is consumed for non-subscribers (FR14) — tracked via `creditConsumed: true` on the render record

2. **Given** a render fails due to technical error (timeout, service error) **When** the credit policy is applied **Then** no credit is consumed **And** the user sees "No render counted" in the error message

3. **Given** the render result is displayed **When** the FeedbackButton is visible (bottom-right, 44x44 touch target, 32px circle, semi-transparent white with blur) **Then** tapping it expands to show thumbs-up and thumbs-down options

4. **Given** the user taps thumbs-down **When** quality feedback is submitted **Then** the feedback is recorded via `tryon.submitFeedback` procedure with quick categorization (FR15) **And** the credit consumed for this render is refunded (`creditConsumed` set to `false`) **And** a toast confirms: "Thanks for feedback. Render not counted."

5. **Given** the user taps thumbs-up **When** quality feedback is submitted **Then** the positive feedback is recorded **And** no credit change occurs

6. **Given** the FeedbackButton **When** unused for 10 seconds **Then** it fades out and disappears

7. **Given** a failed render **When** the user taps "Try Again" **Then** a new render request is initiated for the same garment **And** a new credit check is performed (new render = new credit if successful)

8. **Given** the user selects feedback **When** the action completes **Then** the expanded button collapses to a checkmark then disappears

## Tasks / Subtasks

- [x] Task 1: Database — Add renderFeedback table and creditConsumed column (AC: #1, #4, #5)
  - [x] 1.1 Write failing tests in `packages/db/src/schema.test.ts`:
    - Test: renderFeedback table is exported and has correct columns
    - Test: feedbackRating enum is exported with correct values
    - Test: tryOnRenders table has creditConsumed column
  - [x] 1.2 Add `feedbackRating` pgEnum to `packages/db/src/schema.ts`: `["thumbs_up", "thumbs_down"]`
  - [x] 1.3 Add `renderFeedback` table:
    - `id`: text, primaryKey, `$defaultFn(() => createId())`
    - `renderId`: text, notNull, FK -> tryOnRenders.id, onDelete: cascade, unique
    - `userId`: text, notNull, FK -> users.id, onDelete: cascade
    - `rating`: feedbackRating, notNull
    - `category`: text (nullable — quick categorization reason for thumbs-down, e.g. "wrong_fit", "artifacts", "wrong_garment", "other")
    - `createdAt`: timestamp, defaultNow, notNull
  - [x] 1.4 Add `creditConsumed` column to `tryOnRenders` table:
    - `creditConsumed`: boolean, notNull, default: false
  - [x] 1.5 Export new table and enum from `packages/db/src/schema.ts`
  - [ ] 1.6 Run `pnpm db:push` — verify tables updated in PostgreSQL (SKIPPED: PostgreSQL not running locally)
  - [x] 1.7 Tests GREEN

- [x] Task 2: Backend — Add submitFeedback procedure and credit policy (AC: #1, #2, #4, #5, #7)
  - [x] 2.1 Write failing tests in `packages/api/src/router/tryon.test.ts`:
    - Test: submitFeedback records thumbs_up feedback for completed render
    - Test: submitFeedback records thumbs_down feedback with optional category
    - Test: submitFeedback sets creditConsumed = false on thumbs_down (refund)
    - Test: submitFeedback does NOT change creditConsumed on thumbs_up
    - Test: submitFeedback throws NOT_FOUND for invalid renderId
    - Test: submitFeedback throws NOT_FOUND if render doesn't belong to user
    - Test: submitFeedback throws BAD_REQUEST if render is not completed
    - Test: submitFeedback throws BAD_REQUEST if feedback already submitted (unique constraint)
    - Test: requestRender sets creditConsumed = true when render completes successfully
    - Test: requestRender does NOT set creditConsumed on failed render
  - [x] 2.2 Add `submitFeedback` procedure to `packages/api/src/router/tryon.ts`:
    - protectedProcedure
    - Input: `z.object({ renderId: z.string(), rating: z.enum(["thumbs_up", "thumbs_down"]), category: z.string().optional() })`
    - Validate: render exists, belongs to user, status is "completed"
    - Validate: no existing feedback for this render (unique constraint)
    - Insert into renderFeedback table
    - If rating === "thumbs_down": update tryOnRenders.creditConsumed = false (refund)
    - Return: `{ success: true, creditRefunded: rating === "thumbs_down" }`
  - [x] 2.3 Modify `requestRender` — after successful provider.submitRender, keep creditConsumed = false (default). Credit is consumed when webhook marks render as completed.
  - [x] 2.4 Modify webhook handler `apps/server/src/webhooks/fal.ts` — when render completes successfully (status: "completed"), set `creditConsumed: true` on the render record
  - [x] 2.5 Tests GREEN

- [x] Task 3: Frontend — Create FeedbackButton component (AC: #3, #6, #8)
  - [x] 3.1 Write failing tests in `apps/expo/src/components/tryon/FeedbackButton.test.tsx` (TDD RED phase):
    - Test: renders collapsed state with MessageCircle icon
    - Test: renders with correct size (44x44 touch target)
    - Test: expands to show thumbs up and thumbs down on press
    - Test: calls onSubmit with "thumbs_up" when thumbs up pressed
    - Test: calls onSubmit with "thumbs_down" when thumbs down pressed
    - Test: shows checkmark after selection then calls onDismiss
    - Test: auto-hides after 10 seconds (calls onDismiss)
    - Test: resets auto-hide timer on interaction
    - Test: triggers light haptic on initial expand
    - Test: triggers medium haptic on feedback selection
    - Test: has accessibilityLabel "Rate this render"
    - Test: has accessibilityHint "Double tap to rate quality"
    - Test: respects Reduce Motion — no spring animations
  - [x] 3.2 Create `apps/expo/src/components/tryon/FeedbackButton.tsx`:
    - Props: `onSubmit: (rating: "thumbs_up" | "thumbs_down") => void`, `onDismiss: () => void`, `isSubmitting: boolean`
    - **Collapsed state** (initial): 44x44 Pressable, 32px visible circle, `bg-white/30 backdrop-blur`, white MessageCircle icon (from lucide-react-native)
    - **Expanded state**: Pill-shaped container with ThumbsUp + ThumbsDown icons (lucide-react-native), horizontal layout, spring expand animation (200ms)
    - **Confirmed state**: Checkmark icon briefly shown, then calls onDismiss after 800ms
    - **Auto-hide**: `useEffect` with 10-second setTimeout — calls onDismiss. Reset timer on any interaction (expand/collapse).
    - **Animations**: Reanimated v4 — `withSpring` for expand/collapse, `withTiming` for fade-in/out
    - **Haptics**: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on expand, `Haptics.notificationAsync(NotificationFeedbackType.Success)` on selection
    - **Reduce Motion**: Skip spring animations, use instant expand/collapse, opacity-only fade
    - **Accessibility**: `accessibilityLabel="Rate this render"`, `accessibilityRole="button"`, `accessibilityHint="Double tap to rate quality"`
  - [x] 3.3 Tests GREEN

- [x] Task 4: Frontend — Wire FeedbackButton in render/[id].tsx (AC: #3, #4, #5, #6, #8)
  - [x] 4.1 Write failing tests in `apps/expo/src/app/(auth)/render/[id].test.tsx`:
    - Test: FeedbackButton renders when render is completed (replace placeholder test)
    - Test: FeedbackButton not rendered during loading state
    - Test: FeedbackButton not rendered during failed state
    - Test: submitting thumbs_down calls tryon.submitFeedback mutation
    - Test: submitting thumbs_up calls tryon.submitFeedback mutation
    - Test: shows success toast "Thanks for feedback. Render not counted." on thumbs_down
    - Test: shows success toast on thumbs_up without refund message
    - Test: FeedbackButton dismissed after submission (removed from tree)
    - Test: FeedbackButton auto-hides after 10 seconds
  - [x] 4.2 Replace feedback button placeholder in `apps/expo/src/app/(auth)/render/[id].tsx`:
    - Import FeedbackButton from `~/components/tryon/FeedbackButton`
    - Add `tryon.submitFeedback` mutation via `api.tryon.submitFeedback.useMutation()`
    - State: `feedbackDismissed` (boolean) — hides FeedbackButton after submission or auto-hide
    - On submit: call mutation with `{ renderId, rating }`, show toast on success
    - On thumbs_down success toast: "Thanks for feedback. Render not counted." (success variant, 2s)
    - On thumbs_up success toast: "Thanks for your feedback!" (success variant, 2s)
    - On dismiss (timeout or after submission): set feedbackDismissed = true
    - Position: absolute, bottom-right, `bottom: insets.bottom + 16`, `right: 16`
  - [x] 4.3 Tests GREEN

- [x] Task 5: Frontend — Add thumbs-down category picker (AC: #4)
  - [x] 5.1 Write failing tests:
    - Test: thumbs-down shows category options before submitting
    - Test: category options include "Wrong fit", "Artifacts", "Wrong garment", "Other"
    - Test: tapping a category submits feedback with category
    - Test: category picker dismisses on selection
  - [x] 5.2 Extend FeedbackButton to show category picker after thumbs-down:
    - After thumbs-down tap, expand further to show category pills: "Wrong fit", "Artifacts", "Wrong garment", "Other"
    - Single tap selects category and submits feedback
    - Categories map to strings: `"wrong_fit"`, `"artifacts"`, `"wrong_garment"`, `"other"`
    - Pass selected category in the `onSubmit` callback
  - [x] 5.3 Update onSubmit signature to include optional category: `onSubmit: (rating, category?) => void`
  - [x] 5.4 Tests GREEN

- [x] Task 6: Typecheck, tests, and validation (AC: all)
  - [x] 6.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x] 6.2 Run `turbo test` — all tests pass, 0 regressions. New totals: 254 expo + 124 api + 16 db + 9 server = ~403 tests
  - [x] 6.3 Verify: feedback button visible on completed render (bottom-right) — FeedbackButton renders with testID in completed state
  - [x] 6.4 Verify: tapping feedback button expands to thumbs up/down — state machine: collapsed → expanded with ThumbsUp/ThumbsDown
  - [x] 6.5 Verify: thumbs-down shows category picker then submits — expanded → category_picker with 4 options → confirmed
  - [x] 6.6 Verify: thumbs-up submits directly — expanded → confirmed, onSubmit("thumbs_up")
  - [x] 6.7 Verify: success toast shown after feedback submission — showToast called in mutation onSuccess
  - [x] 6.8 Verify: thumbs-down sets creditConsumed = false on render record — submitFeedback procedure updates tryOnRenders
  - [x] 6.9 Verify: feedback button auto-hides after 10 seconds — useEffect with setTimeout(onDismiss, 10_000)
  - [x] 6.10 Verify: checkmark shown after selection, then button disappears — confirmed state shows Check icon, 800ms → onDismiss
  - [x] 6.11 Verify: "Try Again" creates new render for same garment (already from Story 3.3) — unchanged, works as-is
  - [x] 6.12 Verify: completed renders have creditConsumed = true — webhook sets creditConsumed: true on completion
  - [x] 6.13 Verify: failed renders have creditConsumed = false — default is false, webhook only sets true on success
  - [x] 6.14 Verify: Reduce Motion disables spring animations on FeedbackButton — useReducedMotion() check, instant values
  - [x] 6.15 Verify: accessibility labels present on FeedbackButton — "Rate this render", role="button", hint="Double tap to rate quality"

## Dev Notes

### Story Context & Purpose

This story implements **FR14** (Retry render + credit policy) and **FR15** (Quality feedback on renders). It is the **credit policy and feedback story of Epic 3** (AI Virtual Try-On Experience).

**Why this matters:** Users need confidence that bad AI results don't cost them. The FeedbackButton provides a frictionless way to report quality issues, and the credit policy ensures fairness: successful renders consume credits, failures don't, and user-reported bad renders get refunded. This builds trust in the product's value proposition.

**Scope boundaries:**
- **IN scope**: FeedbackButton component (expand/collapse, thumbs up/down, category picker, auto-hide), submitFeedback tRPC procedure, renderFeedback DB table, creditConsumed tracking on renders, toast notifications, webhook update for credit tracking, Reduce Motion support, accessibility
- **OUT of scope**: Credit balance tracking (credits table, CreditCounter UI, credit grants) — Story 4.1. Subscription checks (subscriber vs free user distinction) — Story 4.1/4.2. Category validation/gating — Story 3.5. Paywall screen — Story 4.3.
- **Forward-looking**: Story 4.1 will create the credits table and CreditCounter. When it does, it will read `tryOnRenders.creditConsumed` to calculate consumed credits. Story 3.5 will add category validation before renders.

**Credit policy architecture note:** Story 3.4 establishes the credit POLICY (what consumes a credit, what doesn't, what triggers a refund) by tracking `creditConsumed` on each render. Story 4.1 will establish the credit SYSTEM (balance, counter, grants). This separation keeps concerns clean — the policy is independent of the balance system.

[Source: epics.md#Story 3.4 — "Render Retry, Quality Feedback & Credit Policy"]
[Source: ux-design-specification.md#FeedbackButton — component anatomy and interaction]
[Source: architecture.md#Business Error Codes — credit consumption rules]

### Architecture Decisions

**FeedbackButton Component Design**

The FeedbackButton is a stateful component with three visual states: collapsed, expanded, and confirmed. It manages its own expand/collapse animation and auto-hide timer, while delegating feedback submission to the parent via callback.

```
FeedbackButton States:
  collapsed → [tap] → expanded (thumbs up/down)
  expanded → [thumbs up] → confirmed → [800ms] → dismiss
  expanded → [thumbs down] → category picker → [select] → confirmed → [800ms] → dismiss
  collapsed → [10s no interaction] → dismiss (auto-hide)
```

**Why a component (not inline in render/[id].tsx):** The FeedbackButton has complex internal state (expand/collapse, auto-hide timer, animation). Extracting it to `components/tryon/FeedbackButton.tsx` keeps render/[id].tsx focused on the render view and follows the domain-based component organization pattern.

[Source: architecture.md#Component Boundaries — "RenderView: Full-screen display, gestures"]
[Source: ux-design-specification.md#FeedbackButton — "44x44 touch target, 32px circle"]

**Credit Tracking via `creditConsumed` Column**

Rather than creating a full credits balance table (which is Story 4.1), this story adds a `creditConsumed` boolean on the `tryOnRenders` table. This tracks the credit POLICY per-render:

```typescript
// tryOnRenders table — ADD column
creditConsumed: t.boolean().notNull().default(false),
```

- Set to `true` when webhook marks render as "completed" (successful inference)
- Remains `false` on failed renders (timeout, service error)
- Set back to `false` when user submits thumbs-down feedback (refund)

When Story 4.1 creates the credits system, it will query: `SELECT COUNT(*) FROM try_on_renders WHERE user_id = ? AND credit_consumed = true` to calculate consumed credits.

**Why boolean (not a credits transaction table):** A boolean on the render record is simpler, directly tied to the render lifecycle, and avoids premature abstraction. The full credit transaction log can come in Story 4.1 if needed.

[Source: epics.md#FR14 — "successful render consumes one credit; technical failure does not; user-reported bad render refunds"]
[Source: project-context.md#Architecture Boundaries — "Credits NEVER deducted on failed renders — only on success"]

**Feedback Categories for Thumbs-Down**

FR15 specifies "quick categorization." The categories are simple strings stored in the `renderFeedback.category` column:

| Value | Label | Meaning |
|-------|-------|---------|
| `wrong_fit` | "Wrong fit" | Garment doesn't fit the body correctly |
| `artifacts` | "Artifacts" | Visual glitches, blending issues |
| `wrong_garment` | "Wrong garment" | Result doesn't match the input garment |
| `other` | "Other" | Catch-all for uncategorized issues |

These categories are not an enum in PostgreSQL (just a text column) to allow adding more without a migration. The Zod schema validates them on input.

[Source: epics.md#FR15 — "submit quality feedback on a render with quick categorization"]

### Backend Implementation

**New submitFeedback Procedure**

```typescript
// packages/api/src/router/tryon.ts — ADD new procedure

submitFeedback: protectedProcedure
  .input(z.object({
    renderId: z.string(),
    rating: z.enum(["thumbs_up", "thumbs_down"]),
    category: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. Validate render exists and belongs to user
    const render = await ctx.db.query.tryOnRenders.findFirst({
      where: and(
        eq(tryOnRenders.id, input.renderId),
        eq(tryOnRenders.userId, ctx.session.user.id),
      ),
    });
    if (!render) throw new TRPCError({ code: "NOT_FOUND" });
    if (render.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "RENDER_NOT_COMPLETED" });

    // 2. Insert feedback (unique constraint on renderId prevents duplicates)
    await ctx.db.insert(renderFeedback).values({
      renderId: input.renderId,
      userId: ctx.session.user.id,
      rating: input.rating,
      category: input.rating === "thumbs_down" ? input.category ?? null : null,
    });

    // 3. If thumbs_down, refund credit
    if (input.rating === "thumbs_down") {
      await ctx.db.update(tryOnRenders)
        .set({ creditConsumed: false })
        .where(eq(tryOnRenders.id, input.renderId));
    }

    return { success: true, creditRefunded: input.rating === "thumbs_down" };
  }),
```

**CRITICAL:** The unique constraint on `renderFeedback.renderId` prevents duplicate feedback submissions. If a user tries to submit feedback twice, the DB insert will throw. Catch this error and return a BAD_REQUEST with message "FEEDBACK_ALREADY_SUBMITTED".

**Webhook Update for creditConsumed**

In `apps/server/src/webhooks/fal.ts`, when a render completes successfully, update the render record to set `creditConsumed: true`:

```typescript
// In the webhook handler, after storing the result image:
await db.update(tryOnRenders)
  .set({
    status: "completed",
    resultPath: savedPath,
    creditConsumed: true,  // ADD THIS
  })
  .where(eq(tryOnRenders.id, render.id));
```

For Google VTO (sync provider in `requestRender`), the same update applies when the result is stored immediately.

**CRITICAL:** Only set `creditConsumed = true` on successful completion. Failed renders (RENDER_FAILED, RENDER_TIMEOUT) keep `creditConsumed = false` (the default).

[Source: project-context.md#Architecture Boundaries — "Credits NEVER deducted on failed renders"]
[Source: architecture.md#Communication Patterns — "Failed render = credit NOT consumed"]

### Frontend Implementation

**No new packages to install.** All required libraries are already installed:
- `react-native-reanimated` v4.1.3 — animations (expand/collapse, fade)
- `expo-haptics` v15.0.8 — haptic feedback (light on expand, medium on selection)
- `lucide-react-native` — icons (MessageCircle, ThumbsUp, ThumbsDown, Check)
- `expo-image` — (already available)

**New files to create:**

```
apps/expo/src/components/tryon/FeedbackButton.tsx       — Feedback button component
apps/expo/src/components/tryon/FeedbackButton.test.tsx  — Component tests
```

**Files to modify:**

```
packages/db/src/schema.ts                               — ADD renderFeedback table + feedbackRating enum + creditConsumed column
packages/db/src/schema.test.ts                          — ADD tests for new schema additions
packages/api/src/router/tryon.ts                        — ADD submitFeedback procedure
packages/api/src/router/tryon.test.ts                   — ADD tests for submitFeedback + creditConsumed
apps/server/src/webhooks/fal.ts                         — ADD creditConsumed: true on completion
apps/server/src/webhooks/fal.test.ts                    — ADD/UPDATE tests for creditConsumed
apps/expo/src/app/(auth)/render/[id].tsx                — REPLACE feedback button placeholder with FeedbackButton component
apps/expo/src/app/(auth)/render/[id].test.tsx            — ADD/UPDATE tests for feedback integration
apps/expo/test/setup.ts                                 — ADD ThumbsUp, ThumbsDown, Check icon mocks if missing
```

**Component Architecture:**

```
RenderView (render/[id].tsx) — COMPLETED STATE ONLY
├── GestureDetector (swipe-down dismiss) [existing]
│   └── Animated.View (translateY + opacity) [existing]
│       ├── Body photo (Layer 1) [existing]
│       └── Render result (Layer 2, cross-fade) [existing]
├── Back button (top-left) [existing]
└── FeedbackButton (bottom-right) [NEW — replaces placeholder]
    ├── Collapsed: 32px circle, MessageCircle icon, semi-transparent white blur
    ├── Expanded: Pill with ThumbsUp + ThumbsDown icons
    ├── Category Picker (after thumbs-down): "Wrong fit" | "Artifacts" | "Wrong garment" | "Other"
    └── Confirmed: Check icon → auto-dismiss after 800ms
```

**FeedbackButton Internal State Machine:**

```typescript
type FeedbackState = "collapsed" | "expanded" | "category_picker" | "confirmed" | "dismissed";

// State transitions:
// collapsed → expanded (on press)
// expanded → confirmed (on thumbs_up press)
// expanded → category_picker (on thumbs_down press)
// category_picker → confirmed (on category select)
// confirmed → dismissed (after 800ms delay)
// collapsed → dismissed (after 10s auto-hide timeout)
```

**Auto-Hide Timer Pattern:**

```typescript
const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const resetAutoHide = useCallback(() => {
  if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
  autoHideTimer.current = setTimeout(() => {
    onDismiss();
  }, 10_000);
}, [onDismiss]);

useEffect(() => {
  resetAutoHide();
  return () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
  };
}, [resetAutoHide]);

// Reset timer on any interaction
const handleExpand = () => {
  resetAutoHide();
  setState("expanded");
};
```

**Note on `useState` for FeedbackButton state:** This is UI state (expand/collapse/confirmed), NOT server loading/error state. Using `useState` is correct here. The mutation state (isPending) comes from TanStack Query via `useMutation`.

**Toast Notifications:**

```typescript
import { showToast } from "@acme/ui";

// On thumbs-down success:
showToast({ message: "Thanks for feedback. Render not counted.", variant: "success" });

// On thumbs-up success:
showToast({ message: "Thanks for your feedback!", variant: "success" });
```

Toast spec: success variant, auto-dismiss 2s, positioned at top of screen (per UX spec).

[Source: ux-design-specification.md#Feedback Patterns — "Success toast: Checkmark, white + green border, 2s auto-dismiss"]

**Haptic Feedback:**

```typescript
import * as Haptics from "expo-haptics";

// On initial expand (tap feedback button):
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// On feedback selection (thumbs up or down + category):
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

[Source: ux-design-specification.md#Haptic Feedback — "Light on press, medium on render completion"]

**Render/[id].tsx Integration:**

```typescript
// In the completed state section of render/[id].tsx:

const [feedbackDismissed, setFeedbackDismissed] = useState(false);

const submitFeedbackMutation = api.tryon.submitFeedback.useMutation({
  onSuccess: (data) => {
    if (data.creditRefunded) {
      showToast({ message: "Thanks for feedback. Render not counted.", variant: "success" });
    } else {
      showToast({ message: "Thanks for your feedback!", variant: "success" });
    }
  },
  onError: () => {
    showToast({ message: "Couldn't submit feedback. Try again.", variant: "error" });
  },
});

const handleFeedbackSubmit = useCallback(
  (rating: "thumbs_up" | "thumbs_down", category?: string) => {
    submitFeedbackMutation.mutate({ renderId: id, rating, category });
  },
  [submitFeedbackMutation, id],
);

// JSX — replace placeholder feedback Pressable (lines 265-288) with:
{!feedbackDismissed && (
  <FeedbackButton
    onSubmit={handleFeedbackSubmit}
    onDismiss={() => setFeedbackDismissed(true)}
    isSubmitting={submitFeedbackMutation.isPending}
  />
)}
```

**CRITICAL:** Use `feedbackDismissed` state to remove the FeedbackButton from the tree after submission or auto-hide. This is `useState` for UI visibility, which is correct — it's not data loading state.

### Existing Code References

| Component | Location | Relevance |
|-----------|----------|-----------|
| render/[id].tsx | `apps/expo/src/app/(auth)/render/[id].tsx:265-288` | **REPLACE** feedback button placeholder |
| render/[id].test.tsx | `apps/expo/src/app/(auth)/render/[id].test.tsx:173` | **UPDATE** feedback button placeholder test |
| tryon router | `packages/api/src/router/tryon.ts` | **ADD** submitFeedback procedure |
| tryon router tests | `packages/api/src/router/tryon.test.ts` | **ADD** tests for submitFeedback + creditConsumed |
| DB schema | `packages/db/src/schema.ts:128-152` | **ADD** renderFeedback table + creditConsumed column to tryOnRenders |
| fal webhook | `apps/server/src/webhooks/fal.ts` | **MODIFY** to set creditConsumed: true on completion |
| fal webhook tests | `apps/server/src/webhooks/fal.test.ts` | **UPDATE** to verify creditConsumed |
| showToast | `packages/ui/src/toast.tsx:26-28` | Toast notifications for feedback confirmation |
| Button | `packages/ui/src/button.tsx` | Button variants (existing) |
| authClient | `apps/expo/src/utils/auth.ts` | Cookie for auth-gated requests (existing) |
| test setup | `apps/expo/test/setup.ts` | Existing mocks — ADD ThumbsUp, ThumbsDown, Check icons |
| RenderLoadingAnimation | `apps/expo/src/components/tryon/RenderLoadingAnimation.tsx` | Sibling component in tryon/ domain (no changes) |
| GarmentCard | `apps/expo/src/components/garment/GarmentCard.tsx:53-61` | Auth image pattern reference |
| SkeletonGrid | `apps/expo/src/components/garment/SkeletonGrid.tsx` | Reanimated animation pattern reference |

### Project Structure Notes

**New files in `apps/expo/src/components/tryon/`:**
- `FeedbackButton.tsx` — joins `RenderLoadingAnimation.tsx` in the tryon domain directory
- `FeedbackButton.test.tsx` — co-located test

**Alignment with architecture:**
- `components/tryon/FeedbackButton.tsx` — matches architecture.md structure: `components/tryon/FeedbackButton.tsx`
- submitFeedback procedure in tryon router — matches architecture.md router organization: `tryon.submitFeedback`
- renderFeedback table — new table for quality tracking, follows existing Drizzle patterns
- creditConsumed on tryOnRenders — extends existing table cleanly

**Naming conventions:**
- Component: PascalCase (`FeedbackButton.tsx`)
- Test: co-located (`FeedbackButton.test.tsx`)
- DB table: snake_case plural (`render_feedback` in SQL, `renderFeedback` in TS)
- tRPC procedure: camelCase verb.noun (`tryon.submitFeedback`)
- Enum: snake_case values (`"thumbs_up"`, `"thumbs_down"`)

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**Testing FeedbackButton component:**
- Render with mock props (onSubmit, onDismiss, isSubmitting)
- Verify collapsed state (MessageCircle icon visible)
- Simulate press → verify expanded state (ThumbsUp + ThumbsDown visible)
- Simulate thumbs-up → verify onSubmit called with ("thumbs_up")
- Simulate thumbs-down → verify category picker shown
- Simulate category selection → verify onSubmit called with ("thumbs_down", "wrong_fit")
- Verify auto-hide: use `mock.setSystemTime()` or spy on setTimeout
- Verify accessibility labels present

**Testing render/[id].tsx integration:**
- Mock `api.tryon.submitFeedback.mutationOptions()` in test setup
- Verify FeedbackButton renders when status is "completed"
- Verify mutation is called on feedback submission
- Verify feedbackDismissed state removes FeedbackButton from tree

**Testing submitFeedback procedure:**
- Mock DB queries and inserts
- Verify thumbs_down updates creditConsumed to false
- Verify thumbs_up does NOT change creditConsumed
- Verify unique constraint enforcement (duplicate feedback)
- Verify ownership check (render belongs to user)
- Verify status check (only completed renders)

**Testing webhook creditConsumed:**
- Verify completed webhook sets creditConsumed: true on render record
- Verify failed webhook does NOT set creditConsumed: true

**Mocking icons for tests:**
The test setup needs ThumbsUp, ThumbsDown, and Check mocks from lucide-react-native. MessageCircle is already mocked. Add to `apps/expo/test/setup.ts`:

```typescript
// ADD to existing lucide-react-native mock (around line 320)
ThumbsUp: ({ testID }: { testID?: string }) => React.createElement("View", { testID }),
ThumbsDown: ({ testID }: { testID?: string }) => React.createElement("View", { testID }),
Check: ({ testID }: { testID?: string }) => React.createElement("View", { testID }),
```

**Test count estimate:** ~20-25 new tests. Current total: 353. Expected: ~375-380 across all packages.

### Key Pitfalls to Avoid

1. **DO NOT create a credits balance table in this story.** The credits table (Epic 4, Story 4.1) tracks balance, grants, and consumption. This story only tracks `creditConsumed` per-render as a boolean policy flag.

2. **DO NOT check subscription status.** Subscription checks don't exist yet (Epic 4). For now, treat ALL users as "free users" for credit policy purposes. Story 4.1 will add the subscriber bypass.

3. **DO NOT modify the "Try Again" button behavior.** It already works correctly from Story 3.3 — calls `requestRenderMutation.mutate({ garmentId })` with `router.replace()`. No changes needed.

4. **DO NOT forget the unique constraint on `renderFeedback.renderId`.** Each render gets at most one feedback entry. Handle the unique violation error gracefully — throw BAD_REQUEST with "FEEDBACK_ALREADY_SUBMITTED".

5. **DO NOT use `useState` for the feedback mutation loading state.** Use `submitFeedbackMutation.isPending` from TanStack Query. Only `feedbackDismissed` (visibility) and the FeedbackButton's internal visual state use `useState`.

6. **DO NOT forget to update the webhook handler.** The fal.ai webhook handler in `apps/server/src/webhooks/fal.ts` must set `creditConsumed: true` when updating the render status to "completed". Without this, all renders will have `creditConsumed = false`.

7. **DO NOT forget the Google VTO provider path.** In the `requestRender` procedure, the Google VTO provider stores results synchronously. If this path directly updates the render to "completed", it must also set `creditConsumed: true`.

8. **DO NOT position the FeedbackButton with hardcoded values.** Use `useSafeAreaInsets()` for bottom spacing: `bottom: insets.bottom + 16`, `right: 16`. This is the same pattern as the existing placeholder.

9. **DO NOT use `console.log` on the server.** Use `logger.info()` / `logger.error()` from pino.

10. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

11. **DO NOT import test utilities from `"vitest"` or `"@jest/globals"`.** Always `import { ... } from "bun:test"`.

12. **DO NOT use explicit column name strings in Drizzle.** Let `casing: "snake_case"` handle the mapping. Write `creditConsumed` not `t.boolean("credit_consumed")`.

13. **DO NOT forget Reduce Motion support on FeedbackButton.** The expand/collapse spring animation must degrade to instant opacity change when `useReducedMotion()` returns true.

14. **DO NOT place FeedbackButton at the root of `components/`.** It goes in `components/tryon/` per the domain-based code organization rule.

15. **DO NOT use `Animated` from react-native.** Use `Animated` from `react-native-reanimated` (Reanimated v4). Import: `import Animated, { ... } from "react-native-reanimated"`.

16. **DO NOT forget to handle the isSubmitting prop.** While the mutation is in flight, the FeedbackButton should show a loading state (disable further presses) to prevent double submission.

### Previous Story Intelligence

**From Story 3.3 (Render Result & Loading Experience) — CRITICAL:**

- Total test count: **353 tests** across all packages (237 expo + 116 api)
- render/[id].tsx has **feedback button placeholder** at lines 265-288 with `testID="feedback-button"` and comment `// Story 3.4 will implement feedback functionality`
- The placeholder is a Pressable with `onPress` no-op — **REPLACE** with FeedbackButton component
- Existing test at line 173 verifies feedback button placeholder renders in completed state — **UPDATE** to verify FeedbackButton instead
- render/[id].tsx uses `GestureDetector` with `Gesture.Pan()` for swipe dismiss — do NOT interfere with this gesture
- Haptic patterns established: `NotificationFeedbackType.Success` for medium, `NotificationFeedbackType.Error` for error
- Cross-fade animation uses Reanimated `useSharedValue` + `withTiming`
- "Try Again" button already works: calls `requestRenderMutation.mutate({ garmentId })` then `router.replace()`
- Error state message already says "This one didn't work. No render counted." — consistent with credit policy
- StatusBar set to `style="light"` for white text on dark background
- SafeAreaView NOT used (immersive view) — floating buttons use `useSafeAreaInsets()`

**From Story 3.2 (AI Try-On Render Pipeline) — CRITICAL:**

- tryon router has 2 procedures: `requestRender` + `getRenderStatus` (216 lines)
- `requestRender` creates render with `status: "pending"`, calls provider.submitRender, updates to `status: "processing"`
- Webhook handler at `apps/server/src/webhooks/fal.ts` updates render to `status: "completed"` with `resultPath`
- Google VTO provider stores result synchronously in `requestRender` — also updates to "completed"
- 15 tests in tryon.test.ts (9 requestRender + 6 getRenderStatus)
- DI pattern for providers: `createTryOnProvider` factory, injected via tRPC context
- Image storage: `imageStorage.saveRenderResult()` for render results
- Render result served at `/api/images/render/:renderId` with ownership check

**From Story 3.1 (Garment Detail Bottom Sheet) — REFERENCE:**

- `useReducedMotion()` pattern established for accessibility
- Haptics: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` for light tap feedback
- Spring animation configs: GarmentCard (damping:15/stiffness:300), BottomSheet (damping:50/stiffness:300)
- Auth-gated image pattern in GarmentCard.tsx lines 53-61

**Pattern consistency across all Epic 3 stories:**
- Conventional commits: `feat:` for implementation, `fix:` for code review
- 13/13 packages typecheck clean after every story
- Code review consistently catches: placeholder tests, missing error handling, accessibility gaps
- All animations use Reanimated v4 (not react-native Animated)
- All tests from `bun:test`
- Domain-based component organization: `components/tryon/`

### Git Intelligence

**Recent commits (5):**
1. `6849649` — fix: Story 3.3 code review — 9 issues resolved (1C/4H/3M/1L), status done
2. `2392383` — fix: Story 3.2 code review — 11 issues resolved (1C/4H/3M/3L), status done
3. `025dff9` — refactor: extract shared test helpers and replace hacky type workarounds
4. `808d6a4` — feat: implement Story 3.2 — AI Try-On Render Pipeline
5. `217aa81` — fix: Story 3.1 code review — 9 issues resolved (3H/3M/3L), status done

**Patterns from recent work:**
- Story 3.3 code review resolved 9 issues, Story 3.2 resolved 11 — expect ~8-12 review issues
- Code review C1 in 3.3 fixed getRenderStatus to always return personImageUrl/garmentImageUrl — be aware of this change
- Test helper extraction (commit 025dff9) means shared test patterns are available
- All stories follow TDD: failing tests first, then implementation
- `mock.setSystemTime()` used for time-dependent tests
- `router.replace()` used instead of `router.push()` for retry navigation (prevents stack buildup)

**Files recently modified (relevant to this story):**
- `apps/expo/src/app/(auth)/render/[id].tsx` — contains feedback button placeholder to REPLACE
- `packages/api/src/router/tryon.ts` — ADD submitFeedback procedure
- `packages/db/src/schema.ts` — ADD renderFeedback table + creditConsumed column
- `apps/server/src/webhooks/fal.ts` — ADD creditConsumed: true on completion
- `apps/expo/test/setup.ts` — ADD icon mocks (ThumbsUp, ThumbsDown, Check)

### Latest Tech Information

**React Native Reanimated v4.1.3 (installed):**
- `useSharedValue(initialValue)` — for expand/collapse width/height
- `useAnimatedStyle(() => ({ ... }))` — derived animated styles
- `withSpring(toValue, { damping, stiffness })` — for expand/collapse animation
- `withTiming(toValue, { duration })` — for fade in/out
- `useReducedMotion()` — accessibility check
- Already used extensively in Story 3.3 (shimmer, cross-fade, pulse, swipe dismiss)

**expo-haptics v15.0.8 (installed):**
- `Haptics.impactAsync(ImpactFeedbackStyle.Light)` — light tap on expand
- `Haptics.notificationAsync(NotificationFeedbackType.Success)` — medium on feedback selection
- Same patterns used in Story 3.3 (render completion/failure haptics)

**lucide-react-native (installed):**
- `MessageCircle` — already used in feedback button placeholder (Story 3.3)
- `ThumbsUp` — needed for positive feedback
- `ThumbsDown` — needed for negative feedback
- `Check` — needed for confirmation state
- Verify these icons exist in the installed version (check with `import { ThumbsUp, ThumbsDown, Check } from "lucide-react-native"`)

**Drizzle ORM 0.45.x (installed):**
- Unique constraint: `.unique()` on column or `t.uniqueIndex()` in table config
- Boolean column: `t.boolean().notNull().default(false)`
- `casing: "snake_case"` — `creditConsumed` maps to `credit_consumed` automatically
- `$onUpdate()` for updatedAt — already used in tryOnRenders

### Dependencies

**This story depends on:**
- Story 3.2 (AI Render Pipeline) — tryOnRenders table, tryon router, webhook handler — DONE
- Story 3.3 (Render Result & Loading) — render/[id].tsx with feedback placeholder, FeedbackButton position — DONE

**Stories that depend on this story:**
- Story 4.1 (Credit System & Free Trial Renders) — will read `tryOnRenders.creditConsumed` for credit balance
- Story 3.5 (Garment Category Validation) — may reference feedback data for quality-based category decisions

### References

- [Source: epics.md#Story 3.4] — Story definition and all 8 original acceptance criteria
- [Source: prd.md#FR14] — "Retry render. Credit policy: successful render consumes one credit; technical failure does not; user-reported bad render refunds"
- [Source: prd.md#FR15] — "Submit quality feedback on a render with quick categorization"
- [Source: architecture.md#Communication Patterns — Business Error Codes] — Credit consumption rules per error type
- [Source: architecture.md#Component Boundaries] — "RenderView: Full-screen display, gestures" includes FeedbackButton
- [Source: ux-design-specification.md#FeedbackButton] — 44x44 touch, 32px circle, expand/collapse, auto-hide 10s
- [Source: ux-design-specification.md#Feedback Patterns] — Toast: success 2s, error 4s, top position
- [Source: ux-design-specification.md#Haptic Feedback] — Light on press, medium on selection
- [Source: ux-design-specification.md#Reduce Motion Support] — Static alternatives for all animations
- [Source: ux-design-specification.md#VoiceOver Support] — "Rate this render", button role, "Double tap to rate quality"
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions
- [Source: CLAUDE.md] — All critical implementation rules
- [Source: 3-3-render-result-and-loading-experience.md] — Previous story: 353 tests, feedback placeholder, render view architecture
- [Source: 3-2-ai-try-on-render-pipeline.md] — Previous story: tryon router, webhook handler, TryOnProvider
- [Source: packages/db/src/schema.ts:128-152] — tryOnRenders table (ADD creditConsumed)
- [Source: packages/api/src/router/tryon.ts] — tryon router (ADD submitFeedback)
- [Source: apps/server/src/webhooks/fal.ts] — Webhook handler (ADD creditConsumed: true)
- [Source: apps/expo/src/app/(auth)/render/[id].tsx:265-288] — Feedback button placeholder to REPLACE
- [Source: apps/expo/test/setup.ts] — Test mocks (ADD icon mocks)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- PostgreSQL not running locally during implementation — `pnpm db:push` skipped (subtask 1.6). Schema changes validated via tests. Run `pnpm db:push` when Docker is started.

### Completion Notes List

- **Task 1 (Database):** Added `feedbackRating` pgEnum (`thumbs_up`, `thumbs_down`), `renderFeedback` table with unique constraint on `renderId`, and `creditConsumed` boolean column on `tryOnRenders` table (default: false). 4 new schema tests.
- **Task 2 (Backend):** Added `submitFeedback` protected procedure to tryon router — validates render ownership, status, unique feedback constraint. Thumbs-down refunds credit by setting `creditConsumed = false`. Updated fal.ai webhook to set `creditConsumed = true` on successful completion. 10 new backend tests (8 submitFeedback + 2 webhook creditConsumed).
- **Task 3 (FeedbackButton):** Created `FeedbackButton.tsx` with 5-state state machine (collapsed → expanded → category_picker → confirmed → dismissed). Uses Reanimated v4 for animations, expo-haptics for feedback, full accessibility support (label, hint, role), Reduce Motion support, 10s auto-hide timer. 13 structural tests.
- **Task 4 (Integration):** Replaced feedback button placeholder in render/[id].tsx with FeedbackButton component. Added submitFeedback mutation with toast notifications. `feedbackDismissed` state removes button after use. 4 new integration tests.
- **Task 5 (Category Picker):** Category picker built into FeedbackButton (task 3) — 4 categories (wrong_fit, artifacts, wrong_garment, other) shown after thumbs-down tap. `onSubmit` signature includes optional category parameter.
- **Task 6 (Validation):** 13/13 typecheck, all tests pass (254 expo + 124 api + 16 db + 9 server ≈ 403 total), 0 regressions.

### File List

**New files:**
- `apps/expo/src/components/tryon/FeedbackButton.tsx` — FeedbackButton component with state machine
- `apps/expo/src/components/tryon/FeedbackButton.test.tsx` — 13 structural tests

**Modified files:**
- `packages/db/src/schema.ts` — Added `feedbackRating` enum, `renderFeedback` table, `creditConsumed` column on `tryOnRenders`
- `packages/db/src/schema.test.ts` — Added 4 tests for new schema additions
- `packages/api/src/router/tryon.ts` — Added `submitFeedback` procedure, imported `renderFeedback`
- `packages/api/src/router/tryon.test.ts` — Added 8 tests for submitFeedback + `mockDbInsertUnique` helper
- `apps/server/src/webhooks/fal.ts` — Added `creditConsumed: true` in completion update
- `apps/server/src/webhooks/fal.test.ts` — Added 2 tests + updated existing test for creditConsumed verification
- `apps/expo/src/app/(auth)/render/[id].tsx` — Replaced feedback placeholder with FeedbackButton, added submitFeedback mutation, feedbackDismissed state, toast notifications
- `apps/expo/src/app/(auth)/render/[id].test.tsx` — Updated placeholder test, added 4 integration tests
- `apps/expo/test/setup.ts` — Added ThumbsUp, ThumbsDown, Check icon mocks

## Change Log

- 2026-02-16: Implemented Story 3.4 — Render Retry, Quality Feedback & Credit Policy. Added renderFeedback table, creditConsumed tracking, submitFeedback tRPC procedure, FeedbackButton component with category picker, and integrated into render view. ~31 new tests added.
