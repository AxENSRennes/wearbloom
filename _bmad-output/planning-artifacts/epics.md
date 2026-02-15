---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Wearbloom - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Wearbloom, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can create an account and authenticate
FR2: User can provide a photo of themselves to create their body avatar (camera capture or gallery import)
FR3: User can update their body avatar with a new photo
FR4: User can delete their account and all associated data
FR5: User can view and accept privacy policy and data usage terms at first launch
FR6: User can add a garment by taking a photo with the camera
FR7: User can add a garment by importing a photo from their device gallery
FR8: User can assign a category to a garment when adding it
FR9: User can browse their garment collection offline
FR10: User can remove a garment from their wardrobe
FR11: User can view stock garments provided by the app
FR12: User can select a single garment and generate an AI virtual try-on render on their body avatar
FR13: User can view the result of a completed try-on render
FR14: User can retry a try-on render. Credit policy: successful render consumes one credit; technical failure (timeout, service error) does not consume a credit; user-reported bad render (quality feedback) refunds the credit
FR15: User can submit quality feedback on a render with quick categorization
FR16: System limits available garment categories to those validated for render quality
FR17: New users receive a limited number of free try-on renders as a trial mechanism. The first render is available without account creation (during onboarding). Additional free renders are granted upon account creation. The exact count is a server-side configuration
FR18: Each AI try-on render consumes one credit for non-subscribers. Credits are not consumed on technical failures or user-reported bad renders (see FR14). Subscribers have unlimited renders with no credit tracking
FR19: User can subscribe to a weekly plan (~4.99€/week) with a 7-day free trial. Trial and subscription managed as Apple auto-renewable subscription. Subscribers get unlimited try-on renders with no credit counter displayed
FR20: Subscription is managed through Apple In-App Purchase
FR21: User can view their remaining credit count
FR22: User can cancel subscription through standard iOS subscription management
FR23: New user is guided through a 3-step onboarding flow (photo of yourself → pick a garment → first try-on result). Each step shows an example photo of the expected input
FR24: New user can select example/stock photos at each onboarding step to experience the full try-on flow without providing own photos
FR25: User can replace example photos with their own at any time after onboarding
FR26: User's wardrobe data and garment thumbnails are cached locally for offline browsing
FR27: User's garment photos are stored securely on the server
FR28: All data transfers between app and server are encrypted (HTTPS)

### NonFunctional Requirements

NFR1: App UI interactions (scroll, navigate) respond in < 300ms
NFR2: AI try-on render completes within 5-10 seconds (external inference service)
NFR3: Time from app download to first try-on result < 60 seconds (using stock photos)
NFR4: Local wardrobe browsing works offline with no perceptible delay (cached thumbnails)
NFR5: All client-server communication over HTTPS
NFR6: User photos stored with access control (no publicly accessible URLs)
NFR7: Authentication tokens stored securely on device (iOS Keychain via Expo SecureStore)
NFR8: Account deletion removes all user data (photos, avatar, wardrobe, usage history)
NFR9: API endpoints authenticated — no unauthenticated access to user data
NFR10: MVP infrastructure sized for early adopter usage (tens to low hundreds of users)
NFR11: Backend architecture must not preclude horizontal scaling
NFR12: AI inference handled by external service — scales independently from backend
NFR13: Image storage growth monitored — migration path to object storage when needed
NFR14: Apple In-App Purchase for subscription management (StoreKit 2)
NFR15: External AI inference service via API — handle timeouts and unavailability gracefully
NFR16: Inference service errors: show user-friendly error, don't consume credit

### Additional Requirements

**From Architecture — Starter Template & Infrastructure:**

- Starter template: create-t3-turbo. Project initialization using this starter is the first implementation story
- Required starter modifications: remove apps/nextjs/ and apps/tanstack-start/, add apps/server/ (standalone tRPC Node.js server), replace Supabase with self-hosted PostgreSQL, replace shadcn-ui with Gluestack UI v3, downgrade NativeWind v5 → v4 and Tailwind CSS v4 → v3, add docker-compose.yml for local dev, add Dockerfile for production server deployment
- Full end-to-end type safety: tRPC v11 + Drizzle ORM + Zod + Turborepo + pnpm workspaces
- Domain-based tRPC routers: auth, garment, tryon, subscription, user
- Zod-validated environment variables (apps/server/src/env.ts)
- Infrastructure: VPS + Dokploy deployment, Traefik reverse proxy with auto HTTPS, Docker Compose for PostgreSQL + server
- CI/CD: GitHub Actions → Docker build → Dokploy (server), GitHub Actions → EAS Build → TestFlight (mobile)
- Structured JSON logging via pino

**From Architecture — Image Pipeline:**

- Server-side background removal: Replicate API with RMBG-2.0 model (~0.0006€/image). Fallback: self-hosted rembg on VPS
- Filesystem image storage on VPS: /data/images/{userId}/ structure with auth-gated serving endpoint
- Client-side image compression: expo-image-manipulator, ~1200px width, JPEG 80% quality before upload
- Image upload via tRPC multipart FormData (tRPC v11 native support)

**From Architecture — AI Inference:**

- TryOnProvider abstraction interface with three provider implementations from day one: FalFashnProvider, FalNanoBananaProvider, GoogleVTOProvider
- fal.ai pattern: queue submit + webhook callback (ED25519 signature verification via libsodium-wrappers)
- Google VTO pattern: synchronous POST, wrapped in async job server-side
- Client polls render status via tRPC every ~2s (3-5 polls max)
- 30-second timeout on render jobs

**From Architecture — Authentication & Subscription:**

- better-auth 1.4.x with Apple Sign-In (primary) + email/password (fallback)
- Ephemeral token for onboarding: server generates temporary token at first launch, authorizes first free render without account, token linked to user at account creation
- Token storage: Expo SecureStore (iOS Keychain)
- Apple IAP validation: StoreKit 2 Server API + App Store Server Notifications V2 webhooks
- Apple webhook security: JWS with x5c certificate chain via @apple/app-store-server-library
- Subscription state machine: no_account → free_with_credits → free_no_credits → trial → subscribed → expired
- Cascading delete pipeline: user → body photos → garment photos → renders → wardrobe metadata → usage history

**From Architecture — Frontend Patterns:**

- State management: TanStack Query via tRPC (server state), React useState/useReducer + Context (local state)
- Offline cache: TanStack Query persistQueryClient with MMKV storage adapter
- Navigation: Expo Router file-based with route groups (auth), (onboarding), (public)
- Animations: React Native Reanimated v4 + Moti
- Grid: FlashList v2 with masonry layout
- Images: expo-image with cache-first, WebP, lazy loading
- Bottom sheet: @gorhom/bottom-sheet with snap points at 60%/90%
- Gestures: react-native-gesture-handler v2 for swipe-down dismiss
- Co-located test files (no separate __tests__/ directory)

**From Architecture — Naming & Format Patterns:**

- Database: snake_case tables/columns, plural table names
- TypeScript: camelCase variables/functions, PascalCase components/types
- JSON API: camelCase fields, ISO 8601 dates, string IDs (cuid2), explicit nulls
- TRPCError for all API errors with typed business codes (INSUFFICIENT_CREDITS, RENDER_FAILED, RENDER_TIMEOUT, INVALID_CATEGORY, SUBSCRIPTION_EXPIRED, IMAGE_TOO_LARGE)
- TanStack Query states for loading management (never useState for loading)

**From UX Design:**

- Immersive Visual design direction: edge-to-edge garment photos, no card borders, 2px grid gutter
- Bottom sheet for garment detail (preserves browsing context) + full-screen modal for render result
- 2-column wardrobe grid at all iPhone sizes, 1:1.2 aspect ratio garment cards
- Color system: premium neutral frame — white (#FFFFFF) background, near-black (#1A1A1A) primary, nude blush (#E8C4B8) accent highlight
- Typography: DM Serif Display for headlines + Inter for body/UI text
- 4px spacing grid, 12px rounded corners on UI elements (0px on grid items)
- Button hierarchy: primary (black fill), secondary (white + black border), ghost (text only), 52px height
- Portrait-only, no dark mode at MVP
- WCAG 2.1 Level AA accessibility compliance
- VoiceOver support with accessibilityLabel on all interactive elements
- Dynamic Type support with maxFontSizeMultiplier 1.5
- Reduce Motion support via useReducedMotion() hook
- Render loading animation: body photo base layer + shimmer overlay + progress text updates at 3s/7s/10s intervals
- Swipe-down as universal dismiss gesture (velocity-based, with Reanimated spring)
- Toast notifications at top of screen (success 2s, error 4s, info 3s)
- Haptic feedback: light on press, medium on render completion, error on failure
- Garment addition flow: camera/gallery → background removal (auto) → category picker (single tap) → save. Under 15 seconds
- Paywall appears at natural moment only (zero free renders + Try On tap). Never random
- Subscribers never see counters or monetization UI

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Creation de compte et authentification |
| FR2 | Epic 1 | Photo corporelle (camera ou galerie) |
| FR3 | Epic 1 | Mise a jour photo corporelle |
| FR4 | Epic 1 | Suppression compte et donnees |
| FR5 | Epic 1 | Consentement vie privee au premier lancement |
| FR6 | Epic 2 | Ajout vetement via camera |
| FR7 | Epic 2 | Ajout vetement via galerie |
| FR8 | Epic 2 | Assignation categorie vetement |
| FR9 | Epic 2 | Navigation garde-robe hors-ligne |
| FR10 | Epic 2 | Suppression vetement |
| FR11 | Epic 2 | Vetements stock fournis par l'app |
| FR12 | Epic 3 | Generation rendu essayage IA |
| FR13 | Epic 3 | Affichage resultat rendu |
| FR14 | Epic 3 | Retry rendu + politique credits |
| FR15 | Epic 3 | Feedback qualite rendu |
| FR16 | Epic 3 | Categories limitees validees |
| FR17 | Epic 4 | Credits gratuits trial |
| FR18 | Epic 4 | Consommation credit par rendu |
| FR19 | Epic 4 | Abonnement hebdo avec essai gratuit |
| FR20 | Epic 4 | Apple In-App Purchase |
| FR21 | Epic 4 | Affichage credits restants |
| FR22 | Epic 4 | Annulation abonnement via iOS |
| FR23 | Epic 5 | Flow onboarding 3 etapes |
| FR24 | Epic 5 | Photos stock a chaque etape |
| FR25 | Epic 5 | Remplacement par propres photos |
| FR26 | Epic 2 | Cache local pour navigation offline |
| FR27 | Epic 2 | Stockage securise serveur |
| FR28 | Epic 1 | Chiffrement HTTPS |

## Epic List

### Epic 1: Project Foundation & User Identity
Users can create an account, authenticate securely, provide their body photo, manage their profile, and delete their data. Includes monorepo setup (create-t3-turbo + modifications), database schema, design system (NativeWind v4, Gluestack UI v3), auth (better-auth, Apple Sign-In, email/password), privacy consent, body avatar capture, profile management, account deletion with cascading delete, and HTTPS enforcement.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR28

### Epic 2: Wardrobe Management
Users can build, browse, and manage their personal garment collection, including offline. Includes garment photo capture/import, server-side background removal, category assignment, image compression + upload pipeline, immersive wardrobe grid (FlashList), category filter pills, garment removal, stock garment library, offline cache (TanStack Query persist + MMKV), and secure server image storage.
**FRs covered:** FR6, FR7, FR8, FR9, FR10, FR11, FR26, FR27

### Epic 3: AI Virtual Try-On Experience
Users can see how any garment looks on their body through AI-powered virtual try-on. Includes TryOnProvider abstraction with 3 provider implementations (fal.ai FASHN, fal.ai Nano Banana Pro, Google VTO), garment detail bottom sheet, single-garment AI render, full-screen render result, render loading animation, retry with credit policy, quality feedback, and category gating.
**FRs covered:** FR12, FR13, FR14, FR15, FR16

### Epic 4: Monetization & Subscription
Users can try renders for free and subscribe for unlimited access. Includes free trial credits, credit tracking and consumption, credit counter display, weekly subscription with 7-day trial via Apple IAP (StoreKit 2), subscription cancellation, paywall screen, subscription state machine, and Apple webhook integration.
**FRs covered:** FR17, FR18, FR19, FR20, FR21, FR22

### Epic 5: Onboarding & First-Time Experience
New users experience the magic of AI try-on within 60 seconds of downloading, with zero friction. Includes 3-step onboarding flow, stock/example photos at each step, replacement with own photos post-onboarding, ephemeral token for pre-account render, and welcome screen.
**FRs covered:** FR23, FR24, FR25

## Epic 1: Project Foundation & User Identity

Users can create an account, authenticate securely, provide their body photo, manage their profile, and delete their data.

### Story 1.1: Initialize Monorepo from Starter Template

As a developer,
I want the project initialized from create-t3-turbo with all required modifications,
So that we have a working monorepo foundation for all subsequent development.

**Acceptance Criteria:**

**Given** create-t3-turbo starter
**When** initialized with `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo`
**Then** monorepo structure is created with apps/ and packages/ directories

**Given** the starter template
**When** modifications are applied
**Then** apps/nextjs/ and apps/tanstack-start/ are removed
**And** apps/server/ is added with a standalone tRPC Node.js server entry point and health check endpoint
**And** packages/db/ connects to self-hosted PostgreSQL via Drizzle ORM (Supabase removed)
**And** packages/ui/ contains Gluestack UI v3 setup (shadcn-ui removed)
**And** NativeWind is downgraded to v4 with Tailwind CSS v3 (Gluestack v3 compatibility)

**Given** local development setup
**When** docker-compose.yml is run
**Then** PostgreSQL container starts and is accessible
**And** Dockerfile for production server builds and starts successfully

**Given** all modifications complete
**When** `pnpm install` is run
**Then** dependencies install without errors
**And** TypeScript compiles cleanly across all packages
**And** Expo app launches on device/simulator with a basic screen
**And** tRPC server starts and responds at the health check endpoint

### Story 1.2: Design System & App Shell Navigation

As a user,
I want the app to have a polished, professional appearance with clear navigation,
So that I can easily move between screens and enjoy a premium experience.

**Acceptance Criteria:**

**Given** the app is launched
**When** any screen is viewed
**Then** the color system is applied: white (#FFFFFF) background, near-black (#1A1A1A) primary text, surface (#F7F7F7) secondary backgrounds, nude blush (#E8C4B8) accent highlight

**Given** the app is launched
**When** headlines are displayed
**Then** DM Serif Display font renders correctly (bundled in assets/fonts/)
**And** body/UI text uses Inter (SF Pro fallback on iOS)
**And** type scale follows spec: display 28px, heading 22px, title 17px, body 15px, caption 13px, small 11px

**Given** the bottom tab bar
**When** visible on screen
**Then** 3 tabs are shown: Wardrobe (home icon), Add (+ in black circle), Profile (person icon)
**And** active tab shows black icon + label, inactive tabs show gray icon with no label
**And** safe area respects iOS home indicator spacing

**Given** Expo Router configuration
**When** route groups are set up
**Then** (auth), (onboarding), and (public) groups exist with proper layout files

**Given** the design system components
**When** Gluestack UI v3 is themed with NativeWind classes
**Then** Button (primary/secondary/ghost), Pressable, Text, Toast, and Spinner components are available
**And** primary buttons are black fill 52px height, secondary are white + black border 52px, ghost are text-only 44px
**And** all spacing follows the 4px grid

### Story 1.3: User Registration & Authentication

As a user,
I want to create an account and sign in securely,
So that my wardrobe and personal data are protected and associated with my identity.

**Acceptance Criteria:**

**Given** the user is not authenticated
**When** they tap Apple Sign-In
**Then** they complete Apple authentication and an account is created in the users table

**Given** the user prefers email
**When** they enter a valid email and password
**Then** an account is created via better-auth
**And** no "confirm password" field is shown (reduced friction per UX spec)

**Given** invalid credentials
**When** the user attempts to sign in
**Then** a user-friendly error message is displayed (inline, real-time validation)

**Given** successful authentication
**When** the token is issued
**Then** it is stored securely in Expo SecureStore (iOS Keychain) (NFR7)

**Given** a returning user
**When** they open the app
**Then** they are automatically signed in using the stored token

**Given** an authenticated user
**When** they make any API request
**Then** the tRPC auth middleware validates the token
**And** all communication uses HTTPS (FR28, NFR5)

**Given** an unauthenticated request
**When** any protected endpoint is accessed
**Then** a 401 Unauthorized TRPCError is returned (NFR9)

**Given** the users table in Drizzle
**When** created
**Then** it uses snake_case columns, string IDs (cuid2), and includes created_at/updated_at timestamps

### Story 1.4: Privacy Consent & Policy Screen

As a user,
I want to view and accept the privacy policy at first launch,
So that I understand how my data is collected, used, and stored before proceeding.

**Acceptance Criteria:**

**Given** it is the user's first launch
**When** the app opens
**Then** a consent screen is displayed with brief data usage explanation, privacy policy link, and "Accept" button (primary, black, full-width)

**Given** the user has not accepted consent
**When** they try to proceed into the app
**Then** they cannot access any features until consent is given

**Given** the user taps the privacy policy link
**When** the policy screen opens
**Then** the full privacy policy is displayed on (public)/privacy.tsx

**Given** the user taps "Accept"
**When** consent is recorded
**Then** the consent screen does not appear on subsequent launches

**Given** the profile/settings screen
**When** the user looks for the privacy policy
**Then** a link to view it is always available

### Story 1.5: Body Avatar Photo Management

As a user,
I want to provide and update a photo of myself,
So that AI try-on renders show garments on my actual body.

**Acceptance Criteria:**

**Given** the user is on the body photo screen
**When** they choose "Take Photo"
**Then** the device camera opens for capture

**Given** the user is on the body photo screen
**When** they choose "Import from Gallery"
**Then** the device photo picker opens

**Given** a photo is captured or imported
**When** it is confirmed
**Then** it is compressed client-side via expo-image-manipulator (~1200px width, JPEG 80% quality)
**And** uploaded to the server via tRPC multipart FormData

**Given** the compressed photo is uploaded
**When** stored on the server
**Then** it is saved at /data/images/{userId}/ with auth-gated access only (NFR6)
**And** served only to the authenticated owner via /api/images/{imageId}

**Given** the user already has a body avatar
**When** they navigate to profile settings
**Then** they see their current photo and an option to update it (FR3)

**Given** the user takes/imports a new photo
**When** confirmed
**Then** the previous photo is replaced on the server

**Given** no body avatar exists
**When** the user views their profile
**Then** a placeholder is shown with a prompt to add a photo

### Story 1.6: Account Deletion

As a user,
I want to delete my account and all associated data,
So that my personal information is completely and permanently removed.

**Acceptance Criteria:**

**Given** the user is in account settings
**When** they tap "Delete Account"
**Then** a confirmation alert dialog appears with destructive action styling (red action button per Gluestack AlertDialog)

**Given** the confirmation dialog
**When** the user confirms deletion
**Then** the cascading delete pipeline executes: user record → body photos → garment photos → renders → wardrobe metadata → usage history (NFR8)

**Given** the deletion completes
**When** all data is removed
**Then** no files or database records remain for this user on the server

**Given** the account is deleted
**When** the user returns to the app
**Then** they are signed out and see the welcome/onboarding screen

**Given** a deletion is in progress
**When** the user waits
**Then** a loading spinner is shown in the button until confirmation of completion

## Epic 2: Wardrobe Management

Users can build, browse, and manage their personal garment collection, including offline.

### Story 2.1: Add Garment with Photo Capture

As a user,
I want to photograph or import a garment and add it to my wardrobe,
So that I can build my personal collection for virtual try-on.

**Acceptance Criteria:**

**Given** the user taps the "+" tab in the bottom bar
**When** the add garment screen opens
**Then** camera and gallery import options are presented (ActionSheet pattern)

**Given** the user chooses camera
**When** the camera opens
**Then** a framing guide overlay is shown ("Place garment flat, good lighting")
**And** a shutter button, gallery import button, and flash toggle are available

**Given** the user chooses gallery import
**When** the photo picker opens
**Then** they can select a garment photo from their device

**Given** a photo is captured or imported
**When** it is confirmed
**Then** it is compressed client-side via expo-image-manipulator (~1200px width, JPEG 80% quality)
**And** uploaded to the server via tRPC garment.upload (multipart FormData)

**Given** the photo is uploaded
**When** the server receives it
**Then** background removal is automatically triggered via Replicate API (RMBG-2.0)
**And** the original photo is stored at /data/images/{userId}/garments/
**And** the cutout is stored as {garmentId}_cutout.png

**Given** background removal completes
**When** the garment preview screen is shown
**Then** the clean cutout is displayed on a white background
**And** a "Retake" option is available if removal quality is poor

**Given** the garment preview
**When** the category picker is displayed
**Then** horizontal scrollable pills show options: Tops, Bottoms, Dresses, Shoes, Outerwear (FR8)
**And** a single tap selects the category

**Given** the user taps "Save to Wardrobe"
**When** the garment is saved
**Then** metadata is stored in the garments table (Drizzle, snake_case, cuid2 ID)
**And** a success toast appears briefly (2s, top of screen)
**And** options to "Add another" or "Browse wardrobe" are presented

**Given** the garments table in Drizzle
**When** created
**Then** it includes: id (cuid2), user_id (FK), category (enum), image_path, cutout_path, created_at, updated_at

### Story 2.2: Wardrobe Grid & Category Browsing

As a user,
I want to browse my garment collection in a beautiful visual grid,
So that I can see what I own and find garments to try on.

**Acceptance Criteria:**

**Given** the user is on the Wardrobe tab
**When** the grid loads
**Then** garment cutout photos are displayed in a 2-column FlashList masonry layout
**And** photos are edge-to-edge with no card borders (immersive visual direction)
**And** 2px gutter between items
**And** garment cards have 1:1.2 aspect ratio

**Given** the wardrobe grid
**When** the user scrolls
**Then** scrolling is smooth at 60fps with FlashList cell recycling (NFR1)
**And** images load from expo-image cache with blur placeholder → sharp progressive loading

**Given** the CategoryPills bar
**When** displayed at the top of the wardrobe
**Then** it is fixed below the status bar with semi-transparent blur backdrop (bg-white/90 backdrop-blur-sm)
**And** shows pills: All, Tops, Bottoms, Dresses, Shoes, Outerwear
**And** active pill is bg-[#1A1A1A] text-white, inactive is bg-[#F7F7F7] text-[#6B6B6B]
**And** pills scroll horizontally with auto-scroll to active pill

**Given** the user taps a category pill
**When** a category is selected
**Then** the grid filters to show only garments in that category
**And** the transition is a 150ms background color cross-fade on the pill

**Given** the user taps a garment
**When** pressed
**Then** a subtle scale-down animation plays (0.97x, 100ms spring via Reanimated)

**Given** the user pulls down on the grid
**When** pull-to-refresh triggers
**Then** wardrobe data is refreshed from the server

**Given** an empty wardrobe
**When** no garments exist
**Then** an EmptyState is shown: "Your wardrobe is waiting" + "Add your first garment" CTA

**Given** accessibility requirements
**When** VoiceOver is active
**Then** each GarmentCard has accessibilityLabel="[category] garment", accessibilityRole="button", accessibilityHint="Double tap to view details"

### Story 2.3: Stock Garment Library

As a user,
I want to browse stock garments provided by the app,
So that I can try the virtual try-on feature before photographing my own clothes.

**Acceptance Criteria:**

**Given** the app is installed
**When** stock garments are loaded
**Then** 6-8 curated stock garments are available from pre-bundled assets (assets/stock/garments/)
**And** garments cover multiple categories (tops, bottoms, dresses) for variety

**Given** the wardrobe grid
**When** stock garments are displayed
**Then** they appear alongside the user's own garments in the same grid
**And** they are browseable by category using the same CategoryPills filter

**Given** a stock garment
**When** the user taps on it
**Then** it behaves identically to a personal garment (same detail flow)

**Given** stock garments are pre-bundled
**When** the app is offline
**Then** stock garments are still available for browsing

### Story 2.4: Remove Garment

As a user,
I want to remove a garment from my wardrobe,
So that I can keep my collection clean and relevant.

**Acceptance Criteria:**

**Given** the user is viewing a garment detail
**When** they choose to delete the garment
**Then** a confirmation is requested before deletion

**Given** the user confirms deletion
**When** the delete action executes
**Then** the garment record is removed from the garments table
**And** the original photo and cutout are deleted from the server filesystem
**And** the garment is removed from the local cache

**Given** the deletion completes
**When** the user returns to the wardrobe grid
**Then** the garment is no longer visible
**And** the grid re-renders without layout shift

**Given** a deletion fails (network error)
**When** the error occurs
**Then** an error toast is shown ("Couldn't delete. Try again.")
**And** the garment remains in the wardrobe

### Story 2.5: Offline Browsing & Data Sync

As a user,
I want to browse my wardrobe even without internet,
So that I can look through my clothes anytime, anywhere.

**Acceptance Criteria:**

**Given** the user has previously loaded their wardrobe online
**When** they open the app offline
**Then** the wardrobe grid loads from local cache with no perceptible delay (NFR4)
**And** garment thumbnails are available from expo-image cache

**Given** TanStack Query persist is configured
**When** wardrobe data is fetched
**Then** it is persisted to MMKV storage adapter automatically
**And** cache survives app restarts

**Given** the user is offline
**When** they try to add a garment
**Then** the upload is queued for when connection is restored

**Given** the user is offline
**When** they try to trigger an AI render
**Then** a message is shown: "Needs internet for try-on"

**Given** the device reconnects to the internet
**When** sync occurs
**Then** queued uploads are processed
**And** wardrobe data is refreshed from the server
**And** a subtle "Back online" info toast appears (3s)

**Given** all garment photos on the server
**When** accessed via API
**Then** they are served only through the auth-gated /api/images/{imageId} endpoint (FR27, NFR6)

**Given** the wardrobe has cached data but is stale
**When** TanStack Query refetches in background
**Then** no loading spinner is shown (isFetching, not isLoading)
**And** the UI updates seamlessly when fresh data arrives

## Epic 3: AI Virtual Try-On Experience

Users can see how any garment looks on their body through AI-powered virtual try-on.

### Story 3.1: Garment Detail Bottom Sheet

As a user,
I want to preview a garment in detail before trying it on,
So that I can decide whether to use a render credit on this garment.

**Acceptance Criteria:**

**Given** the user taps a garment in the wardrobe grid
**When** the GarmentDetailSheet opens
**Then** a bottom sheet rises from the bottom with a spring animation (300ms)
**And** the wardrobe grid remains visible behind, dimmed with a backdrop overlay

**Given** the bottom sheet is open
**When** displayed at the 60% snap point
**Then** it shows: handle bar at top, large garment photo (fills width, maintains aspect ratio), category badge pill below photo, and a prominent "Try On" button (primary black, full-width)

**Given** the bottom sheet
**When** the user swipes up
**Then** it expands to the 90% snap point showing the garment photo larger

**Given** the bottom sheet is open
**When** the user swipes down past the dismiss threshold
**Then** the sheet dismisses with a spring animation and returns to the wardrobe grid

**Given** the bottom sheet backdrop
**When** the user taps on the dimmed area
**Then** the sheet dismisses and returns to the wardrobe grid

**Given** the "Try On" button
**When** always visible within the sheet
**Then** it remains accessible at both 60% and 90% snap points

**Given** accessibility requirements
**When** VoiceOver is active
**Then** the bottom sheet handle has accessibilityLabel="Garment details", accessibilityRole="adjustable", accessibilityHint="Swipe up or down to resize"

### Story 3.2: AI Try-On Render Pipeline

As a user,
I want to generate an AI virtual try-on render of a garment on my body,
So that I can see how it looks on me before getting dressed.

**Acceptance Criteria:**

**Given** the user taps "Try On" in the garment detail sheet
**When** the render is requested
**Then** the client calls tryon.requestRender via tRPC with garmentId
**And** the server validates the user has a body avatar photo and the garment exists

**Given** the server receives a render request
**When** processing begins
**Then** a render record is created in the renders table (status: pending, cuid2 ID)
**And** the active TryOnProvider is selected based on environment config
**And** the provider's submitRender is called with personImage and garmentImage paths

**Given** the TryOnProvider interface
**When** implemented
**Then** three providers exist: FalFashnProvider, FalNanoBananaProvider, GoogleVTOProvider
**And** each implements submitRender(personImage, garmentImage, options) returning a jobId
**And** each implements getResult(jobId) returning TryOnResult
**And** provider selection is via environment config, switchable without code change

**Given** fal.ai providers (FASHN, Nano Banana Pro)
**When** a render is submitted
**Then** the job is sent via fal.ai queue API
**And** a webhook URL is provided for completion callback
**And** the webhook validates ED25519 signature via X-Fal-Webhook-Signature header (libsodium-wrappers)
**And** on webhook receipt, the render result image is downloaded and stored at /data/images/{userId}/renders/
**And** the renders table is updated (status: complete, result_path set)

**Given** Google VTO provider
**When** a render is submitted
**Then** a synchronous POST is made to Vertex AI virtual-try-on-001
**And** the response is wrapped in an async job pattern server-side
**And** the result image is stored and renders table updated identically to fal.ai flow

**Given** the client is waiting for a render
**When** polling for status
**Then** tryon.getRenderStatus is called every ~2s (3-5 polls max)
**And** returns the current status (pending, processing, complete, failed)

**Given** a render exceeds 30 seconds
**When** the timeout is reached
**Then** the render status is set to failed with RENDER_TIMEOUT
**And** a TRPCError with code RENDER_TIMEOUT is returned to the client

**Given** the AI inference service is unavailable
**When** a render fails
**Then** the render status is set to failed with RENDER_FAILED
**And** server retries once for 5xx errors, no retry for 422 validation errors

**Given** the renders table in Drizzle
**When** created
**Then** it includes: id (cuid2), user_id (FK), garment_id (FK), provider (enum), status (enum: pending, processing, complete, failed), job_id, result_path, error_code, created_at, updated_at

### Story 3.3: Render Result & Loading Experience

As a user,
I want to see my try-on render in a focused, immersive view with an engaging loading experience,
So that the AI result gets my full attention and the wait feels acceptable.

**Acceptance Criteria:**

**Given** a render is initiated
**When** the RenderView modal opens
**Then** it is full-screen with no chrome (no tab bar, no navigation bar)
**And** the user's body photo is immediately displayed as the base layer (from cache)

**Given** the render is loading
**When** 0-3 seconds have elapsed
**Then** a shimmer overlay animation sweeps across the body photo
**And** a subtle pulsing scale animation plays (1.0x → 1.02x → 1.0x, 2s loop)
**And** progress text shows "Creating your look..." (Inter 13px, semi-transparent white)

**Given** the render is still loading
**When** 3-7 seconds have elapsed
**Then** a floating garment thumbnail animation is added

**Given** the render is still loading
**When** 7-10 seconds have elapsed
**Then** progress text changes to "Almost there..."

**Given** the render is still loading
**When** 10+ seconds have elapsed
**Then** progress text changes to "Taking a bit longer..."

**Given** the render completes successfully
**When** the result image is received
**Then** a cross-fade transition (500ms ease) from body photo to render result plays
**And** floating UI elements fade in: back button (top-left, semi-transparent circle) and feedback button (bottom-right)
**And** medium haptic feedback is triggered

**Given** the render result is displayed
**When** the user swipes down
**Then** the modal dismisses with velocity-based gesture (fast swipe = instant dismiss with spring, slow drag = interactive follow-finger)
**And** the user returns to the wardrobe grid

**Given** the render result is displayed
**When** the user taps the back button (top-left)
**Then** the modal dismisses and returns to the wardrobe grid

**Given** a render fails
**When** an error state is shown
**Then** the message reads "This one didn't work. No render counted." with a "Try Again" button (secondary)
**And** error haptic feedback is triggered

**Given** Reduce Motion is enabled (iOS accessibility)
**When** animations play
**Then** shimmer is replaced with static "Loading..." text + spinner
**And** cross-fade is replaced with instant image swap

### Story 3.4: Render Retry, Quality Feedback & Credit Policy

As a user,
I want to retry a render and report quality issues,
So that I'm not penalized for technical failures or bad AI results.

**Acceptance Criteria:**

**Given** a render completes successfully
**When** the credit policy is applied
**Then** one credit is consumed for non-subscribers (FR14)

**Given** a render fails due to technical error (timeout, service error)
**When** the credit policy is applied
**Then** no credit is consumed
**And** the user sees "No render counted" in the error message

**Given** the render result is displayed
**When** the FeedbackButton is visible (bottom-right, 44x44 touch target, 32px circle, semi-transparent white with blur)
**Then** tapping it expands to show thumbs-up and thumbs-down options

**Given** the user taps thumbs-down
**When** quality feedback is submitted
**Then** the feedback is recorded via tryon router with quick categorization (FR15)
**And** the credit consumed for this render is refunded (FR14)
**And** a toast confirms: "Thanks for feedback. Render not counted."

**Given** the user taps thumbs-up
**When** quality feedback is submitted
**Then** the positive feedback is recorded
**And** no credit change occurs

**Given** the FeedbackButton
**When** unused for 10 seconds
**Then** it fades out and disappears

**Given** a failed render
**When** the user taps "Try Again"
**Then** a new render request is initiated for the same garment
**And** a new credit check is performed (new render = new credit if successful)

**Given** the user selects feedback
**When** the action completes
**Then** the expanded button collapses to a checkmark then disappears

### Story 3.5: Garment Category Validation

As a user,
I want to only see garment categories where AI renders work well,
So that I have a good experience and don't waste renders on unsupported categories.

**Acceptance Criteria:**

**Given** the server configuration
**When** supported categories are defined
**Then** a server-side config determines which garment categories are validated for render quality (FR16)
**And** categories can be enabled/disabled without app updates

**Given** the active TryOnProvider
**When** its supportedCategories are queried
**Then** it returns the list of GarmentCategory enums it supports

**Given** the garment detail bottom sheet
**When** a garment in an unsupported category is viewed
**Then** the "Try On" button is disabled or hidden
**And** a message explains why (e.g., "Try-on not yet available for this category")

**Given** a render is requested for an unsupported category
**When** the server validates the request
**Then** a TRPCError with message INVALID_CATEGORY is returned
**And** no credit is consumed

**Given** the add garment flow
**When** the category picker is displayed
**Then** all categories are available for organization purposes
**And** unsupported categories are visually marked (e.g., subtle badge "try-on coming soon")

## Epic 4: Monetization & Subscription

Users can try renders for free and subscribe for unlimited access.

### Story 4.1: Credit System & Free Trial Renders

As a user,
I want to receive free try-on renders to experience the app's value,
So that I can decide if a subscription is worth it based on real results.

**Acceptance Criteria:**

**Given** a brand new user without an account
**When** they complete their first try-on during onboarding
**Then** the render is free and does not require account creation (FR17)
**And** an ephemeral token authorizes this render server-side

**Given** a user creates an account
**When** account creation completes
**Then** additional free render credits are granted (exact count is a server-side configuration) (FR17)
**And** the credits are stored in the credits table

**Given** a free user with credits remaining
**When** they request a try-on render
**Then** one credit is consumed on successful render completion (FR18)
**And** no credit is consumed on technical failure or user-reported bad quality

**Given** a subscriber
**When** they request a try-on render
**Then** no credit is consumed and no credit tracking occurs (FR18)
**And** renders are unlimited

**Given** the CreditCounter component
**When** a free user has credits remaining
**Then** the count is displayed as subtle text (not a prominent warning) (FR21)

**Given** the CreditCounter component
**When** a subscriber is active (trial or paid)
**Then** the counter is completely hidden — no counters, no monetization UI visible

**Given** the credits table in Drizzle
**When** created
**Then** it includes: id (cuid2), user_id (FK), total_granted, total_consumed, created_at, updated_at

**Given** the free credit count configuration
**When** managed server-side
**Then** it can be changed without an app update (environment variable or database config)

### Story 4.2: Apple IAP Subscription Integration

As a user,
I want to subscribe to unlimited try-on renders through a simple in-app purchase,
So that I can try on any garment, anytime, without worrying about credits.

**Acceptance Criteria:**

**Given** the app uses Apple In-App Purchase
**When** the subscription product is configured
**Then** a weekly auto-renewable subscription exists at ~$4.99/week with a 7-day free trial (FR19, FR20)

**Given** the client-side integration
**When** StoreKit 2 is implemented
**Then** the subscription product is loaded and available for purchase
**And** the native Apple payment sheet is presented on purchase

**Given** a successful purchase
**When** the transaction completes
**Then** the server validates the receipt via StoreKit 2 Server API
**And** the subscription record is created/updated in the subscriptions table
**And** the user's subscription status is updated to "trial" or "subscribed"

**Given** the subscriptions table in Drizzle
**When** created
**Then** it includes: id (cuid2), user_id (FK), apple_transaction_id, status (enum: trial, subscribed, expired, cancelled), started_at, expires_at, created_at, updated_at

**Given** the subscription state machine
**When** states transition
**Then** valid transitions are: no_account → free_with_credits → free_no_credits → trial → subscribed → expired
**And** state is consistent between client and server

**Given** a user's subscription status
**When** queried via tRPC subscription router
**Then** the current status, expiry date, and whether renders are allowed are returned
**And** the response determines UI behavior (counters, paywall, unlimited access)

### Story 4.3: Paywall Screen

As a user,
I want to see a compelling subscription offer at the right moment,
So that I'm motivated to subscribe when I've experienced the app's value.

**Acceptance Criteria:**

**Given** a free user with zero credits remaining
**When** they tap "Try On" on any garment
**Then** the PaywallScreen modal appears instead of starting a render (FR19)

**Given** the PaywallScreen
**When** displayed
**Then** it shows: close button (X) top-right, headline "Unlimited Try-Ons" (DM Serif 28px), the user's first render as hero image (proof of value), 3 benefit bullets with check icons, primary CTA "Start Your 7-Day Free Trial" (black, full-width, large), price disclosure "Then $4.99/week. Cancel anytime." (Inter 13px, gray), Apple Pay badge, and "Restore Purchases" link at bottom

**Given** the user taps "Start Your 7-Day Free Trial"
**When** Apple Pay / StoreKit 2 payment sheet appears
**Then** one tap confirms the trial start

**Given** a successful subscription
**When** the transaction completes
**Then** a celebration moment is shown: "Welcome! Try on anything, anytime."
**And** the pending render proceeds immediately
**And** credit counter disappears permanently

**Given** the user declines the purchase
**When** they dismiss or cancel
**Then** a soft message appears: "No worries — your wardrobe is always here"
**And** they return to the wardrobe grid
**And** no repeated prompts or guilt messaging

**Given** the PaywallScreen
**When** processing a purchase
**Then** the button shows a spinner with "Confirming..."
**And** the button remains the same size (no layout shift)

**Given** a returning user who previously subscribed
**When** they tap "Restore Purchases"
**Then** their subscription is restored via StoreKit 2
**And** access is re-enabled if the subscription is still active

**Given** the PaywallScreen
**When** an error occurs during purchase
**Then** "Something went wrong. Try again." is shown with a retry option

### Story 4.4: Subscription Lifecycle & Apple Webhooks

As a user,
I want my subscription status to always be accurate,
So that I have uninterrupted access when subscribed and clear information when it expires.

**Acceptance Criteria:**

**Given** App Store Server Notifications V2
**When** the webhook endpoint is configured at apps/server/src/webhooks/apple.ts
**Then** it receives real-time subscription events from Apple (renewal, cancellation, expiration, billing issue)

**Given** an incoming Apple webhook
**When** the notification is received
**Then** the JWS signature is verified using x5c certificate chain via @apple/app-store-server-library
**And** invalid signatures are rejected with 401

**Given** a subscription renewal event
**When** processed
**Then** the subscriptions table is updated with new expires_at
**And** the user's status remains "subscribed"

**Given** a subscription cancellation
**When** the user cancels via iOS Settings (FR22)
**Then** the subscription remains active until the current period expires
**And** the subscriptions table is updated with status "cancelled" and the end date

**Given** a subscription expiration
**When** the period ends without renewal
**Then** the user's status transitions to "expired"
**And** the user falls back to free_no_credits (or free_with_credits if unused credits remain)
**And** on next "Try On" tap, the paywall is shown with "Resubscribe" messaging

**Given** a billing issue (e.g., failed payment)
**When** Apple notifies via webhook
**Then** the subscription enters a grace period per Apple's policy
**And** the user retains access during the grace period

**Given** the user opens the app
**When** subscription status is checked
**Then** the client queries the server for current status
**And** the UI reflects the accurate state (unlimited access, expired, or free)

## Epic 5: Onboarding & First-Time Experience

New users experience the magic of AI try-on within 60 seconds of downloading, with zero friction.

### Story 5.1: Ephemeral Token & Pre-Account Authorization

As a new user,
I want to try the app immediately without creating an account,
So that I can experience the value before committing my personal information.

**Acceptance Criteria:**

**Given** a brand new user opens the app for the first time
**When** the app launches
**Then** the server generates an ephemeral token and returns it to the client
**And** the token is stored locally via Expo SecureStore

**Given** an ephemeral token
**When** the user requests their first try-on render during onboarding
**Then** the token authorizes the render without requiring account creation
**And** the render is free (not counted against any credit balance)

**Given** an ephemeral token
**When** the user later creates an account
**Then** the ephemeral token is linked to the new user record
**And** the onboarding render result is preserved and associated with the account
**And** the ephemeral token is invalidated and replaced by the authenticated session token

**Given** an ephemeral token
**When** it is not converted to an account
**Then** no phantom user records exist in the database
**And** the token expires after a reasonable period (server-side TTL)

**Given** an ephemeral token
**When** used for any request other than the onboarding render
**Then** the request is rejected — ephemeral tokens only authorize the first render flow

### Story 5.2: Three-Step Onboarding Flow

As a new user,
I want to be guided through a simple onboarding that shows me the app's magic,
So that I understand the value and feel excited to use it.

**Acceptance Criteria:**

**Given** the user has not completed onboarding
**When** the app opens
**Then** the OnboardingFlow is displayed as a horizontal pager with a step indicator (3 dots: active = black, inactive = light gray)

**Given** Step 1 — "Your Photo"
**When** displayed
**Then** headline reads "First, let's see you" (DM Serif 28px)
**And** subtext reads "Take a photo or use an example" (Inter 15px, gray)
**And** a stock body photo is shown as preview (prominent, easy to select)
**And** camera and gallery import buttons are available
**And** the user can proceed with the stock photo or their own (FR24)

**Given** Step 2 — "Pick a Garment"
**When** displayed
**Then** headline reads "Now, choose something to try" (DM Serif 28px)
**And** a grid of 6-8 curated stock garments is shown (selected for best render quality)
**And** garments cover multiple categories for variety
**And** a "Or photograph your own" ghost link is available at the bottom
**And** a single tap selects a garment (FR24)

**Given** Step 3 — "See the Magic"
**When** displayed
**Then** the AI render launches automatically using the selected body photo and garment
**And** the RenderLoadingAnimation plays (body photo base + shimmer + progress text)
**And** on completion, the render result is displayed full-screen immersive (FR23)

**Given** the render result in Step 3
**When** the user is impressed
**Then** a CTA "Create Free Account" (primary black button) is displayed
**And** a secondary option "Try another combination" (ghost button) returns to Step 2

**Given** the render result in Step 3
**When** the user wants to try another combination
**Then** they return to Step 2 to pick a different garment
**And** the flow remains within the onboarding (no account required)

**Given** any onboarding step
**When** an example/stock photo is available
**Then** it is clearly presented as the low-friction option at each step (FR24)
**And** the user is never forced to provide their own photos to proceed

### Story 5.3: Account Creation After First Render

As a new user who has just seen my first try-on render,
I want to create an account easily,
So that I can save my wardrobe and get additional free renders.

**Acceptance Criteria:**

**Given** the user taps "Create Free Account" after their first render
**When** the account creation screen appears
**Then** Apple Sign-In is the prominent primary option (one tap, full-width black button)
**And** email/password is available as a secondary option below

**Given** the user completes account creation
**When** the account is saved
**Then** the ephemeral token is linked to the new user account
**And** the onboarding render result is preserved in the user's history
**And** additional free render credits are granted (server-side configured count)
**And** body photo from onboarding (own or stock) is associated with the user profile

**Given** successful account creation
**When** the transition to the main app begins
**Then** the user is navigated to the wardrobe grid (home tab)
**And** stock garments from onboarding are visible in the wardrobe
**And** if the user provided their own garment photo, it appears in the wardrobe too

**Given** the user skips account creation
**When** they dismiss the CTA
**Then** they can continue trying stock combinations in onboarding
**But** cannot access the full wardrobe or add their own garments without an account

### Story 5.4: Replace Example Photos Post-Onboarding

As a user who onboarded with stock photos,
I want to replace the example body photo and garments with my own,
So that the app reflects my real wardrobe and body.

**Acceptance Criteria:**

**Given** the user onboarded with a stock body photo
**When** they navigate to profile settings
**Then** a prompt encourages them to add their own body photo (FR25)
**And** the body avatar management flow (Story 1.5) is available to capture/import their photo

**Given** the user replaces the stock body photo
**When** the new photo is saved
**Then** all future renders use the user's own body photo
**And** previous renders made with the stock photo remain viewable

**Given** stock garments in the wardrobe
**When** the user adds their own garments
**Then** own garments appear alongside stock garments in the grid
**And** the user can use either for try-on renders

**Given** the user wants to remove stock garments
**When** they choose to hide or remove them
**Then** stock garments can be removed from the visible wardrobe
**And** they remain available to re-add if needed

**Given** a user who onboarded with their own photos
**When** they access the main app
**Then** no replacement prompts are shown — their own photos are already in use
