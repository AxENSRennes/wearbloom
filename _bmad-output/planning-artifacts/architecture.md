---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-09'
project_name: 'wearbloom'
user_name: 'Axel'
date: '2026-02-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

28 functional requirements across 6 domains:

| Domain | FRs | Architectural Significance |
|--------|-----|---------------------------|
| User Account & Identity | FR1-FR5 (5) | Auth system, body avatar storage, GDPR data deletion pipeline, privacy consent flow |
| Wardrobe Management | FR6-FR11 (6) | Image capture/import, categorization, local caching for offline browse, stock garment library |
| Virtual Try-On | FR12-FR16 (5) | Core product — external AI inference orchestration, render result storage, quality feedback loop, category gating |
| Subscription & Credits | FR17-FR22 (6) | Apple IAP integration (StoreKit 2), credit tracking system, subscription state machine, paywall logic |
| Onboarding | FR23-FR25 (3) | 3-step flow with stock photos, deferred account creation, immediate value delivery |
| Data & Sync | FR26-FR28 (3) | Local cache strategy, server-side image storage, HTTPS enforcement |

**Non-Functional Requirements:**

| Category | Requirement | Architectural Impact |
|----------|-------------|---------------------|
| Performance | UI interactions < 300ms | Local-first data, optimistic UI, FlashList cell recycling |
| Performance | AI render 5-10s | Async job pattern, engaging loading UX, timeout handling (30s) |
| Performance | First try-on < 60s | Pre-bundled stock assets, no account gate before first render |
| Security | HTTPS, no public image URLs | Signed URL or auth-gated image serving, secure storage backend |
| Security | Keychain token storage | Expo SecureStore for auth tokens |
| Security | Full account deletion | Cascading delete pipeline: user → photos → avatar → wardrobe → usage history |
| Scalability | MVP: tens to low hundreds of users | VPS adequate, but architecture must not preclude horizontal scaling |
| Scalability | External AI inference | Scales independently — cost and availability are external risks |
| Integration | Apple IAP (StoreKit 2) | Server-side receipt validation, subscription status sync |
| Integration | Nano Banana Pro API | External dependency: handle timeouts, errors, unavailability gracefully |

**Scale & Complexity:**

- Primary domain: iOS mobile app + REST API backend + external AI inference service
- Complexity level: Medium — focused feature set but non-trivial integrations (AI inference, Apple IAP, image pipeline)
- Estimated architectural components: ~8-10 (auth, wardrobe, inference orchestration, image storage, subscription management, onboarding, caching/sync, API gateway)

### Technical Constraints & Dependencies

| Constraint | Source | Architectural Implication |
|-----------|--------|--------------------------|
| React Native + Expo (managed workflow) | PRD | No custom native modules. All functionality must work within Expo ecosystem |
| No Mac available | PRD | iOS builds via EAS Build only. Testing via TestFlight + physical device. No Xcode debugging |
| Personal VPS + Dokploy | PRD | Single server deployment. Backend must be containerized. Limited ops tooling |
| External AI inference (Nano Banana Pro) | PRD | Critical external dependency. Must handle as unreliable — timeouts, retries, circuit breaker pattern |
| Solo developer | PRD | Architecture must minimize operational surface. Prefer managed services and simple patterns over sophisticated infrastructure |
| iOS-first, no Android at MVP | PRD | Can use iOS-specific APIs (Keychain, StoreKit) directly. Cross-platform abstraction not required yet |
| Zero burn rate | PRD | No paid cloud services at MVP. VPS + external AI service only |
| NativeWind v4 (Tailwind CSS v3) + Gluestack UI v3 | UX Spec + Architecture | Styling and component library locked in. Gluestack v3 incompatible with NativeWind v5 (hard crash: missing cssInterop + resolveConfig). Downgrade from starter's v5 required |
| Expo Router (file-based) | UX Spec | Navigation architecture defined by file system structure |
| @gorhom/bottom-sheet | UX Spec | Bottom sheet pattern for garment detail — requires gesture handler and reanimated |
| FlashList v2 (masonry) | UX Spec | Wardrobe grid performance — cell recycling, estimated item sizes |
| Background removal (server-side only) | Architecture decision | All garment background removal handled server-side via API. No on-device processing, even long-term. Simplifies Expo managed workflow (no native ML modules) |

### Cross-Cutting Concerns Identified

1. **Authentication & Authorization** — Touches user accounts, API security, subscription verification, image access control. Every API endpoint must validate auth + subscription state.

2. **Image Pipeline** — The entire product revolves around images: body photo capture → garment photo capture → upload → server-side background removal → storage → AI inference input → render result storage → client caching. This is the most complex data flow in the system.

3. **Offline/Online Sync** — Wardrobe browsing works offline (cached thumbnails + metadata). Uploads queue when offline. Sync on reconnect. This requires a deliberate cache invalidation and conflict resolution strategy.

4. **Subscription State Machine** — The user's subscription status (no_account → free_with_credits → free_no_credits → trial → subscribed → expired) affects rendering permissions, UI display, and paywall triggering. This state must be consistent between client and server.

5. **AI Inference Orchestration** — External service call with 5-10s latency, potential failures, cost implications. Requires: async request/response pattern, credit deduction only on success, timeout handling, graceful degradation.

6. **Apple Compliance** — IAP for all digital purchases (Apple's mandatory 30% cut), privacy consent at first launch, data deletion capability, subscription transparency, App Store review guidelines. Non-negotiable constraints that shape auth, payment, and data flows.

### Early Architectural Decisions

**Decision: Full End-to-End Type Safety**

The architecture will enforce type safety from database to mobile client with zero code generation:

| Layer | Technology | Role |
|-------|-----------|------|
| API | tRPC v11 | End-to-end typed RPC — types flow automatically from server to client |
| ORM | Drizzle ORM + PostgreSQL | Schema-as-TypeScript code, type-safe queries, ~7KB footprint |
| Validation | Zod | Runtime validation schemas shared between client and server |
| Monorepo | Turborepo + pnpm workspaces | Shared type packages between Expo app and Node.js server |

Type flow: Drizzle table → drizzle-zod generates Zod schemas → Zod used as tRPC input validators → tRPC infers types for the client → Expo app gets full autocomplete + type checking. No codegen step required.

**Decision: Server-Side Background Removal**

All garment background removal is processed server-side. No on-device processing, even as a future fallback.

- MVP: Replicate API with RMBG-2.0 model (~0.0006€/image, state-of-the-art quality)
- Scale: Self-hosted rembg on VPS via Docker (zero cost, good quality)
- Rationale: Consistent quality across all devices, no native ML modules needed, model upgradeable without app updates, compatible with Expo managed workflow. Industry standard — Whering, Acloset, Photoroom all use server-side.

## Starter Template Evaluation

### Primary Technology Domain

Mobile app (iOS) + API backend — identified from project requirements as a React Native (Expo) mobile client communicating with a Node.js tRPC server, with external AI inference and Apple IAP integrations.

### Starter Options Considered

| Starter | Verdict | Reason |
|---------|---------|--------|
| **create-t3-turbo** | Selected | Only actively maintained starter combining Expo + tRPC v11 + Drizzle + Turborepo + pnpm. ~6K stars, MIT, updated Feb 9, 2026 |
| Expo Starter (expostarter.com) | Rejected | Paid product, Expo SDK 53 (behind), NativeWind v3 (two versions behind) |
| boilerplate-next-expo-trpc | Rejected | Small community, fewer features |
| Custom from scratch | Rejected | create-t3-turbo provides identical setup; no reason to rebuild |

### Selected Starter: create-t3-turbo

**Rationale:** The only free, actively maintained monorepo starter that combines our exact stack: Expo SDK 54 + tRPC v11 + Drizzle ORM + Turborepo + pnpm workspaces. It establishes monorepo patterns, type sharing, and tRPC ↔ TanStack Query wiring for Expo out of the box.

**Initialization Command:**

```bash
npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**

- TypeScript strict mode across all packages
- React 19, React Native 0.81
- Node.js for server runtime
- pnpm as package manager (required)

**Current Versions (verified Feb 2026):**

| Technology | Version | Status |
|-----------|---------|--------|
| Expo SDK | 54 | Stable |
| tRPC | 11.9.0 | Stable |
| Drizzle ORM | 0.45.x | Stable (v1 beta available) |
| NativeWind | v4 (Tailwind CSS v3) | Stable |
| Turborepo | 2.8.3 | Stable |
| better-auth | 1.4.x | Stable |

**Styling Solution:**

- NativeWind v4 with Tailwind CSS v3 (build-time compilation, zero runtime cost)
- Matches UX spec design system (NativeWind v4 + Gluestack UI v3)
- Note: Starter ships with NativeWind v5 — downgrade to v4 during project setup

**Build Tooling:**

- Turborepo for task orchestration and caching
- EAS Build for iOS builds (no Mac required)
- Docker for server deployment to Dokploy

**Code Organization:**

```
wearbloom/
  apps/
    expo/              # Expo SDK 54, tRPC client, NativeWind v4
    server/            # tRPC standalone server (Node.js) → Docker → Dokploy
  packages/
    api/               # tRPC router definitions (shared types)
    auth/              # better-auth (Apple Sign-In, email)
    db/                # Drizzle ORM + PostgreSQL self-hosted
    ui/                # Gluestack UI v3 components (replaces starter's shadcn-ui)
    validators/        # Shared Zod schemas
  tooling/
    eslint/            # Shared ESLint config
    prettier/          # Shared Prettier config
    tailwind/          # Shared Tailwind CSS v3 config
    typescript/        # Shared TSConfig presets
  turbo.json
  pnpm-workspace.yaml
  docker-compose.yml   # PostgreSQL + server (local dev)
  Dockerfile           # Production build for Dokploy
```

**Required Modifications from Base Starter:**

1. Remove `apps/nextjs/` and `apps/tanstack-start/` (not needed)
2. Add `apps/server/` — standalone tRPC Node.js server for Dokploy deployment
3. Replace Supabase connection with self-hosted PostgreSQL in `packages/db/`
4. Replace shadcn-ui with Gluestack UI v3 in `packages/ui/`
5. Downgrade NativeWind v5 → v4 and Tailwind CSS v4 → v3 (Gluestack v3 incompatible with v5)
6. Add `docker-compose.yml` for local dev (PostgreSQL container)
7. Add `Dockerfile` for production server deployment

**Note:** Project initialization using this starter should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

All critical decisions have been made: database (PostgreSQL), API layer (tRPC v11), ORM (Drizzle), auth (better-auth), AI inference providers (fal.ai + Google Vertex AI), image storage (filesystem), monorepo structure (Turborepo + pnpm).

**Important Decisions (Shape Architecture):**

State management, routing structure, CI/CD pipeline, monitoring approach, offline caching strategy — all decided below.

**Deferred Decisions (Post-MVP):**

- CDN for image delivery (evaluate when VPS bandwidth becomes bottleneck)
- Object storage migration (MinIO/S3 when filesystem limits are reached)
- Push notification infrastructure (Phase 2)
- Analytics platform (evaluate after initial user traction)

### Data Architecture

| Decision | Choice | Version | Rationale |
|----------|--------|---------|-----------|
| Database | PostgreSQL | Latest stable | Self-hosted on VPS via Docker. Handles JSON, full-text search, advanced indexing. Dokploy native support |
| ORM | Drizzle ORM | 0.45.x | Schema-as-TypeScript, type-safe queries, ~7KB, zero binary dependencies. drizzle-zod for Zod schema generation |
| Image storage | Filesystem on VPS | N/A | `/data/images/{userId}/` structure. Auth-gated endpoint for serving. Migration path to S3/MinIO documented |
| Offline cache | TanStack Query persist + MMKV | Latest | TanStack Query `persistQueryClient` with MMKV as storage adapter. Automatic cache persistence, ~30x faster than AsyncStorage |
| Image cache (client) | expo-image | Latest | Built-in caching and lazy loading. No additional configuration needed |
| Image upload | Multipart via tRPC | tRPC v11 | FormData support native in tRPC v11. Single authenticated endpoint, type-safe |
| Image compression | expo-image-manipulator | Latest | Client-side compression before upload: ~1200px width, JPEG 80% quality. Reduces bandwidth and VPS storage |
| Migrations | drizzle-kit | Latest | Schema push for dev, migration files for production |

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth library | better-auth 1.4.x | From starter. Framework-agnostic TypeScript auth. Supports Apple Sign-In and email/password |
| Primary auth | Apple Sign-In | One-tap sign-in, US market standard, Apple requirement for apps with third-party auth |
| Fallback auth | Email/password | Via better-auth, for users who prefer not to use Apple Sign-In |
| Onboarding without auth | Ephemeral token | Server generates a temporary token at first launch. Authorizes first free render without account. Token linked to user at account creation. No phantom accounts in database |
| Token storage | Expo SecureStore | iOS Keychain via Expo SecureStore. Secure, encrypted, platform-native |
| Image access control | Auth-gated endpoint | `/api/images/{imageId}` verifies user ownership before serving. No publicly accessible image URLs |
| Apple IAP validation | StoreKit 2 Server API + Webhooks | Initial validation via StoreKit 2 Server API. Real-time updates via App Store Server Notifications V2. Subscription state synced to user record |
| Account deletion | Cascading delete pipeline | user → body photos → garment photos → renders → wardrobe metadata → usage history. Apple + GDPR requirement |

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API framework | tRPC v11 standalone | End-to-end type safety. Standalone Node.js adapter for Docker/Dokploy deployment |
| Router organization | Domain-based routers | Separate routers: auth, garment, tryon, subscription, user. Each isolated and testable |
| AI inference platform | fal.ai (primary) + Google Vertex AI (secondary) | Both providers implemented from day one via `TryOnProvider` abstraction interface |
| AI models available | FASHN (fal.ai), Nano Banana Pro (fal.ai), virtual-try-on-001 (Google) | Switchable per config. A/B testable. Same abstraction layer |
| Inference call pattern | Queue submit + webhook (fal.ai), Sync call (Google VTO) | fal.ai: server submits job, receives webhook on completion. Google: synchronous POST, wrapped in async job server-side |
| Render status (client) | Polling via tRPC | Client polls server every ~2s (3-5 polls max). Simple, reliable, no SSE edge cases on React Native |
| Error handling | TRPCError + typed business codes | Codes: INSUFFICIENT_CREDITS, RENDER_FAILED, RENDER_TIMEOUT, INVALID_CATEGORY, SUBSCRIPTION_EXPIRED, IMAGE_TOO_LARGE. Failed render = credit NOT consumed |
| Background removal | Server-side via Replicate API (RMBG-2.0) | Called during garment upload flow. ~0.0006€/image. Fallback: self-hosted rembg on VPS |

**TryOnProvider Abstraction:**

```typescript
interface TryOnProvider {
  submitRender(personImage: string, garmentImage: string, options: RenderOptions): Promise<string>; // returns jobId
  getResult(jobId: string): Promise<TryOnResult>;
  readonly name: string;
  readonly supportedCategories: GarmentCategory[];
}

// Implementations:
// - FalFashnProvider (fal.ai FASHN model)
// - FalNanoBananaProvider (fal.ai Nano Banana Pro)
// - GoogleVTOProvider (Vertex AI virtual-try-on-001)
```

Provider selected via environment config. All three available in codebase from day one.

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| State management (server) | TanStack Query via tRPC | Automatic with tRPC client. Handles caching, refetching, optimistic updates |
| State management (local) | React state (useState/useReducer) + Context | No global store needed. App is simple enough. Context for shared ephemere state (e.g., active render) |
| Navigation | Expo Router (file-based) | Route groups: (auth) for protected, (onboarding) for first-time flow, (public) for paywall/privacy |
| Component library | Gluestack UI v3 | Unstyled, accessible components themed with NativeWind classes |
| Animations | React Native Reanimated v4 + Moti | 60fps UI-thread animations. Moti for simplified API |
| Grid performance | FlashList v2 | Cell recycling, estimated item sizes. Target: 60fps with 200+ garments |
| Image display | expo-image | Cache-first, WebP support, lazy loading, blur placeholder |
| Bottom sheet | @gorhom/bottom-sheet | Garment detail view. Snap points at 60%/90% |
| Gestures | react-native-gesture-handler v2 | Swipe-down dismiss for renders and bottom sheets |

**Route Structure:**

```
apps/expo/app/
  (auth)/              # Protected routes (auth required)
    (tabs)/             # Bottom tab layout
      index.tsx         # Wardrobe grid (home tab)
      add.tsx           # Add garment (+ tab)
      profile.tsx       # Profile/settings (user tab)
    garment/[id].tsx    # Garment detail (bottom sheet)
    render/[id].tsx     # Render result (full-screen modal)
  (onboarding)/        # Onboarding flow (no auth)
    welcome.tsx
    step1.tsx           # Body photo
    step2.tsx           # Pick garment
    step3.tsx           # First render
  (public)/            # Public screens
    paywall.tsx
    privacy.tsx
  _layout.tsx           # Root layout
```

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| VPS hosting | Personal VPS + Dokploy | Zero burn rate. Containerized deployment. Traefik reverse proxy with auto HTTPS (Let's Encrypt) |
| Reverse proxy | Traefik | Managed by Dokploy. Automatic HTTPS, routing to containers |
| Container orchestration | Docker Compose | Node.js server + PostgreSQL + persistent image volume. Simple, reliable for single-server |
| CI/CD (server) | GitHub Actions → Docker build → push to registry → Dokploy pull & deploy | Free tier sufficient for solo dev |
| CI/CD (mobile) | GitHub Actions → EAS Build → TestFlight | Automated iOS builds without Mac |
| Logging | pino (structured JSON) | Lightweight, fast, consultable via Dokploy logs interface |
| Monitoring (MVP) | Health check endpoint + Dokploy alerts + Dokploy API | `/health` endpoint. Dokploy alerts on container crash. Logs accessible via API/MCP (no UI needed). Metrics via SQL queries (renders/day, conversions) |
| Secrets management | Dokploy secrets (server) + EAS secrets (mobile) | Environment-specific, encrypted at rest |
| Infrastructure management | Dokploy REST API + MCP server | Programmatic deployment, env var updates, log access, container management — no manual UI interaction needed. MCP server enables AI agent-driven infrastructure operations |

**VPS Architecture:**

```
VPS (Dokploy)
  ├── traefik              # Reverse proxy + HTTPS auto (managed by Dokploy)
  ├── wearbloom-server      # Node.js tRPC server (Docker container)
  ├── postgres             # PostgreSQL (Docker container)
  └── /data/images/        # Persistent volume for user images
```

**Dokploy Programmatic Access:**

Dokploy exposes a full REST API and an official MCP server ([github.com/Dokploy/mcp](https://github.com/Dokploy/mcp)) for AI agent-driven infrastructure management. This eliminates manual UI interaction for deployment operations.

| Capability | Method | Use Case |
|-----------|--------|----------|
| Deploy/redeploy apps | API + MCP | CI/CD and agent-triggered deployments |
| Manage environment variables | API + MCP | Secret rotation, config updates |
| Read container logs | API + MCP | Debugging, monitoring |
| Start/stop services | API + MCP | Maintenance, incident response |
| Project/service management | API + MCP | Provisioning new services |

- **Auth**: API key generated in Dokploy Settings > Profile > API/CLI section, passed via `x-api-key` header
- **MCP server**: 67 tools with semantic annotations (`readOnlyHint`, `destructiveHint`) — AI agents know which operations are safe vs destructive
- **MCP transport**: stdio (for Claude Code, Cursor, VS Code) or HTTP/SSE (for remote access)

**Environment Variables:**

```
# Server
DATABASE_URL=postgresql://...
FAL_API_KEY=...
GOOGLE_CLOUD_CREDENTIALS=...
APPLE_IAP_SHARED_SECRET=...
BETTER_AUTH_SECRET=...
REPLICATE_API_TOKEN=...
DOKPLOY_API_KEY=...              # For programmatic infra management (MCP server + CI/CD)

# Expo (build-time via EAS)
EXPO_PUBLIC_API_URL=https://api.wearbloom.app
```

### Decision Impact Analysis

**Implementation Sequence:**

1. Monorepo setup (create-t3-turbo + modifications)
2. Database schema (Drizzle + PostgreSQL)
3. Auth flow (better-auth + Apple Sign-In + ephemeral tokens)
4. Image pipeline (upload → compression → background removal → storage)
5. AI inference integration (TryOnProvider + fal.ai + Google VTO)
6. Subscription system (Apple IAP + StoreKit 2)
7. Frontend screens (onboarding → wardrobe → try-on → paywall)

**Cross-Component Dependencies:**

- Auth → everything (all endpoints require auth except onboarding first render)
- Image pipeline → AI inference (garment photos feed the try-on model)
- Subscription state → try-on flow (gates render access)
- TryOnProvider abstraction → AI inference (enables model switching)
- Offline cache → wardrobe browsing (TanStack Query persist enables offline use)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 5 categories where AI agents could make different choices — naming, structure, format, communication, and process patterns. All resolved below.

### Naming Patterns

**Database Naming Conventions (Drizzle + PostgreSQL):**

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | snake_case, plural | `users`, `garments`, `try_on_renders` |
| Columns | snake_case | `user_id`, `created_at`, `garment_category` |
| Foreign keys | {singular_table}_id | `user_id`, `garment_id` |
| Indexes | idx_{table}_{columns} | `idx_users_email`, `idx_garments_user_id` |
| Enums | snake_case | `garment_category`, `subscription_status` |

Note: Drizzle maps between camelCase TypeScript and snake_case SQL automatically. Schema code uses camelCase (`userId`), PostgreSQL stores as snake_case (`user_id`).

**Code Naming Conventions (TypeScript):**

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `getUserGarments`, `renderResult` |
| React components | PascalCase | `WardrobeGrid`, `GarmentCard` |
| Types, interfaces | PascalCase | `TryOnResult`, `GarmentCategory` |
| Component files | PascalCase.tsx | `WardrobeGrid.tsx`, `PaywallScreen.tsx` |
| Utility files | camelCase.ts | `imageCompressor.ts`, `authUtils.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FREE_CREDITS`, `RENDER_TIMEOUT_MS` |
| Zod schemas | camelCase + Schema suffix | `garmentCreateSchema`, `userProfileSchema` |
| tRPC routers | camelCase | `garmentRouter`, `tryonRouter` |
| tRPC procedures | camelCase, verb.noun | `garment.upload`, `tryon.requestRender` |

**Route Naming (Expo Router):**

| Element | Convention | Example |
|---------|-----------|---------|
| Route files | camelCase or kebab-case | `index.tsx`, `step1.tsx` |
| Layout groups | (name) | `(auth)`, `(onboarding)`, `(public)` |
| Dynamic routes | [param].tsx | `garment/[id].tsx`, `render/[id].tsx` |

### Structure Patterns

**Project Organization:**

```
packages/api/src/
  router/                    # One file per domain
    auth.ts
    garment.ts
    tryon.ts
    subscription.ts
    user.ts
  services/                  # Business logic
    tryOnProvider.ts          # Interface + factory
    providers/
      falFashn.ts
      falNanoBanana.ts
      googleVTO.ts
    imageProcessor.ts        # Compression, background removal
    subscriptionManager.ts
  middleware/                 # tRPC middleware
    auth.ts
    rateLimiter.ts
  utils/                     # Shared utilities
  root.ts                    # Merge all routers
  trpc.ts                    # tRPC init + context

apps/expo/src/
  components/                # Reusable components
    ui/                      # Design system (Gluestack wrappers)
    garment/                 # Garment domain components
    tryon/                   # Try-on domain components
  hooks/                     # Custom hooks
  utils/                     # Client-side utilities
  constants/                 # App constants
```

**Test Location: Co-located with source files.**

```
services/
  imageProcessor.ts
  imageProcessor.test.ts     # Test next to source file
components/
  garment/
    GarmentCard.tsx
    GarmentCard.test.tsx
```

No separate `__tests__/` directory. Tests live with the code they test.

### Format Patterns

**API Data Exchange Formats:**

| Rule | Convention | Example |
|------|-----------|---------|
| JSON fields | camelCase | `{ userId, garmentCategory, createdAt }` |
| Dates | ISO 8601 strings | `"2026-02-09T14:30:00.000Z"` |
| IDs | string (cuid2) | `"clx1a2b3c..."` |
| Nulls | explicit | `{ avatar: null }` (never omit the field) |
| Booleans | true/false | Never 0/1 |
| Image references | relative URL | `"/api/images/abc123"` |

**tRPC Response Format:**

tRPC handles response wrapping automatically. No custom wrapper like `{ success: true, data: ... }`. Mutations return the object directly. Errors are typed `TRPCError` instances.

### Communication Patterns

**Error Handling:**

```typescript
// CORRECT: TRPCError with business code
throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'INSUFFICIENT_CREDITS',
  cause: { remainingCredits: 0 },
});

// WRONG: generic throw
throw new Error('No credits');
```

Client-side error handling via TanStack Query `onError`:

```typescript
const mutation = api.tryon.requestRender.useMutation({
  onError: (error) => {
    if (error.message === 'INSUFFICIENT_CREDITS') {
      // Show paywall
    }
  },
});
```

**Business Error Codes:**

| Code | When | Credit consumed? |
|------|------|-----------------|
| `INSUFFICIENT_CREDITS` | Free user, zero renders left | No |
| `RENDER_FAILED` | AI inference returned error | No |
| `RENDER_TIMEOUT` | 30s timeout exceeded | No |
| `INVALID_CATEGORY` | Garment category not supported | No |
| `SUBSCRIPTION_EXPIRED` | Subscription lapsed | No |
| `IMAGE_TOO_LARGE` | Photo exceeds size limit | No |

### Process Patterns

**Loading States — use TanStack Query states exclusively:**

| State | Usage |
|-------|-------|
| `isLoading` | First load (show skeleton) |
| `isFetching` | Background refresh (no spinner) |
| `isError` | Error (show message + retry) |
| `isPending` | Mutation in progress (spinner in button) |

Never use `useState(false)` for loading management — TanStack Query handles this.

**Retry Strategy:**

| Context | Retry behavior |
|---------|---------------|
| Read queries | TanStack Query automatic (3 attempts, exponential backoff) — default, do not change |
| Mutations | No automatic retry. User decides to retry |
| AI inference | Server retries once for 5xx errors. No retry for 422 (validation error) |

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions above — never snake_case in TypeScript code, never camelCase in SQL table/column names
2. Co-locate tests with source files — never create a separate `__tests__/` directory
3. Use `TRPCError` for all API errors — never generic `throw new Error()`
4. Use TanStack Query states for loading/error — never `useState` for loading management
5. Return dates as ISO 8601 — never timestamps or localized formats
6. Use string IDs (cuid2) — never auto-increment integers
7. Place new components in the correct domain folder — never at the root of `components/`
8. Use the `TryOnProvider` interface for AI inference calls — never call fal.ai or Google directly from routes

**Anti-Patterns (NEVER do this):**

```typescript
// ❌ WRONG: loading state with useState
const [loading, setLoading] = useState(false);
const handlePress = async () => {
  setLoading(true);
  await doSomething();
  setLoading(false);
};

// ✅ CORRECT: TanStack Query mutation
const mutation = api.garment.upload.useMutation();
// mutation.isPending gives you the loading state

// ❌ WRONG: generic error
throw new Error('Something went wrong');

// ✅ CORRECT: typed TRPCError
throw new TRPCError({ code: 'BAD_REQUEST', message: 'IMAGE_TOO_LARGE' });

// ❌ WRONG: direct provider call in router
const result = await fal.subscribe("fal-ai/fashn/tryon/v1.6", { ... });

// ✅ CORRECT: through abstraction
const provider = getTryOnProvider(config.activeProvider);
const result = await provider.submitRender(personImage, garmentImage);
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
wearbloom/
├── .github/
│   └── workflows/
│       ├── server-deploy.yml        # GitHub Actions → Docker → Dokploy
│       └── mobile-build.yml         # GitHub Actions → EAS Build → TestFlight
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── apps/
│   ├── expo/                        # 📱 iOS mobile app
│   │   ├── app/                     # Expo Router (file-based routing)
│   │   │   ├── _layout.tsx          # Root layout (auth check, providers)
│   │   │   ├── (onboarding)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── welcome.tsx      # FR23
│   │   │   │   ├── step1.tsx        # FR2, FR24: Body photo
│   │   │   │   ├── step2.tsx        # FR11, FR24: Pick garment
│   │   │   │   └── step3.tsx        # FR12: First render
│   │   │   ├── (auth)/
│   │   │   │   ├── _layout.tsx      # Auth guard + tab layout
│   │   │   │   ├── (tabs)/
│   │   │   │   │   ├── _layout.tsx  # Bottom tab bar
│   │   │   │   │   ├── index.tsx    # FR9: Wardrobe grid
│   │   │   │   │   ├── add.tsx      # FR6, FR7: Add garment
│   │   │   │   │   └── profile.tsx  # FR3, FR4: Profile
│   │   │   │   ├── garment/
│   │   │   │   │   └── [id].tsx     # FR8: Garment detail
│   │   │   │   └── render/
│   │   │   │       └── [id].tsx     # FR13: Render result
│   │   │   └── (public)/
│   │   │       ├── paywall.tsx      # FR19, FR20
│   │   │       └── privacy.tsx      # FR5
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/              # Design system (Gluestack wrappers)
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Toast.tsx
│   │   │   │   │   └── Spinner.tsx
│   │   │   │   ├── garment/
│   │   │   │   │   ├── WardrobeGrid.tsx
│   │   │   │   │   ├── GarmentCard.tsx
│   │   │   │   │   ├── CategoryPills.tsx
│   │   │   │   │   ├── GarmentDetailSheet.tsx
│   │   │   │   │   └── AddGarmentFlow.tsx
│   │   │   │   ├── tryon/
│   │   │   │   │   ├── RenderView.tsx
│   │   │   │   │   ├── RenderLoadingAnimation.tsx
│   │   │   │   │   └── FeedbackButton.tsx
│   │   │   │   ├── subscription/
│   │   │   │   │   ├── PaywallScreen.tsx
│   │   │   │   │   └── CreditCounter.tsx
│   │   │   │   ├── onboarding/
│   │   │   │   │   └── OnboardingFlow.tsx
│   │   │   │   └── common/
│   │   │   │       ├── EmptyState.tsx
│   │   │   │       └── BottomTabBar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSubscriptionStatus.ts
│   │   │   │   ├── useImagePicker.ts
│   │   │   │   └── useOfflineStatus.ts
│   │   │   ├── utils/
│   │   │   │   ├── imageCompressor.ts
│   │   │   │   └── trpc.ts
│   │   │   └── constants/
│   │   │       ├── categories.ts
│   │   │       └── config.ts
│   │   ├── assets/
│   │   │   ├── stock/
│   │   │   │   ├── body/
│   │   │   │   └── garments/
│   │   │   ├── fonts/
│   │   │   │   └── DMSerifDisplay.ttf
│   │   │   └── images/
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── tailwind.config.ts
│   │   ├── global.css
│   │   ├── metro.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── server/                      # 🖥️ Node.js backend
│       ├── src/
│       │   ├── index.ts             # Entry point (standalone tRPC)
│       │   ├── env.ts               # Zod-validated env vars
│       │   ├── webhooks/
│       │   │   ├── fal.ts           # fal.ai render completion
│       │   │   └── apple.ts         # App Store Server Notifications V2
│       │   └── images/
│       │       └── serve.ts         # Auth-gated image serving
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── api/                         # 🔌 tRPC routers
│   │   ├── src/
│   │   │   ├── root.ts
│   │   │   ├── trpc.ts
│   │   │   ├── router/
│   │   │   │   ├── auth.ts          # FR1, FR4, FR5
│   │   │   │   ├── garment.ts       # FR6-FR11
│   │   │   │   ├── tryon.ts         # FR12-FR16
│   │   │   │   ├── subscription.ts  # FR17-FR22
│   │   │   │   └── user.ts          # FR2, FR3
│   │   │   ├── services/
│   │   │   │   ├── tryOnProvider.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── falFashn.ts
│   │   │   │   │   ├── falNanoBanana.ts
│   │   │   │   │   └── googleVTO.ts
│   │   │   │   ├── imageProcessor.ts
│   │   │   │   ├── imageStorage.ts
│   │   │   │   └── subscriptionManager.ts
│   │   │   └── middleware/
│   │   │       └── auth.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                        # 🔐 Authentication
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── apple.ts
│   │   │   └── ephemeral.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── db/                          # 🗄️ Database
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── garments.ts
│   │   │   │   ├── renders.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   ├── credits.ts
│   │   │   │   └── index.ts
│   │   │   └── seed.ts
│   │   ├── drizzle/
│   │   │   └── migrations/
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── validators/                  # ✅ Shared Zod schemas
│   │   ├── src/
│   │   │   ├── garment.ts
│   │   │   ├── tryon.ts
│   │   │   ├── user.ts
│   │   │   ├── subscription.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── ui/                          # 🎨 Gluestack UI v3
│       ├── src/
│       │   ├── index.ts
│       │   ├── gluestack-config.ts
│       │   └── components/
│       ├── tsconfig.json
│       └── package.json
│
├── tooling/
│   ├── eslint/
│   │   ├── base.js
│   │   └── package.json
│   ├── prettier/
│   │   ├── index.js
│   │   └── package.json
│   ├── tailwind/
│   │   ├── base.css
│   │   └── package.json
│   └── typescript/
│       ├── base.json
│       ├── expo.json
│       ├── server.json
│       └── package.json
│
├── docker-compose.yml               # Local dev: PostgreSQL + server
├── turbo.json
├── pnpm-workspace.yaml
├── .npmrc                           # node-linker=hoisted
├── .env.example
├── .gitignore
└── package.json
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Inside | Outside | Communication |
|----------|--------|---------|---------------|
| tRPC API | All business logic, data access, auth | Expo app client | tRPC over HTTPS |
| Image serving | Filesystem access, auth check | Expo app | Auth-gated HTTP GET |
| fal.ai webhook | Render result processing | fal.ai servers | HTTPS POST to webhook endpoint |
| Apple webhook | Subscription event processing | Apple servers | HTTPS POST to webhook endpoint |

**Data Boundaries:**

| Layer | Accesses | Does NOT access |
|-------|----------|----------------|
| Expo app | tRPC client, local cache (MMKV), expo-image cache | Database directly, filesystem, external APIs |
| tRPC routers | Services, Drizzle queries | Filesystem directly, external APIs directly |
| Services | Drizzle ORM, filesystem (imageStorage), external APIs (providers) | Nothing restricted |
| Drizzle ORM | PostgreSQL | Nothing else |

**Component Boundaries (Expo):**

| Component | Owns | Depends on |
|-----------|------|-----------|
| WardrobeGrid | Grid layout, scroll, empty state | GarmentCard, CategoryPills |
| GarmentDetailSheet | Bottom sheet, garment preview | Button (ui), tRPC mutation |
| RenderView | Full-screen display, gestures | RenderLoadingAnimation, FeedbackButton |
| PaywallScreen | Paywall UI, Apple Pay | tRPC subscription queries |
| OnboardingFlow | 3-step pager, stock photos | tRPC auth (ephemeral token) |

### Requirements to Structure Mapping

| FR Domain | Routes | Router | DB Schema | Components | Services |
|-----------|--------|--------|-----------|------------|----------|
| User Account (FR1-5) | profile, privacy | auth, user | users | — | — |
| Wardrobe (FR6-11) | index, add, garment/[id] | garment | garments | garment/* | imageProcessor, imageStorage |
| Try-On (FR12-16) | render/[id] | tryon | renders | tryon/* | tryOnProvider, providers/* |
| Subscription (FR17-22) | paywall | subscription | subscriptions, credits | subscription/* | subscriptionManager |
| Onboarding (FR23-25) | (onboarding)/* | auth | — | onboarding/* | — |
| Data & Sync (FR26-28) | — | — | — | — | TanStack Query persist + MMKV |

### External Integration Points

| Integration | Server Entry Point | Config Key | Data Flow |
|-------------|-------------------|------------|-----------|
| fal.ai (FASHN + Nano Banana Pro) | services/providers/falFashn.ts, falNanoBanana.ts | FAL_API_KEY | Server → fal.ai queue → webhook → server |
| Google Vertex AI VTO | services/providers/googleVTO.ts | GOOGLE_CLOUD_CREDENTIALS | Server → sync POST → response |
| Replicate (bg removal) | services/imageProcessor.ts | REPLICATE_API_TOKEN | Server → API → response |
| Apple IAP | services/subscriptionManager.ts + webhooks/apple.ts | APPLE_IAP_SHARED_SECRET | App → StoreKit → server validation + Apple webhooks |
| Apple Sign-In | packages/auth/src/apple.ts | Via better-auth | App → Apple → server token exchange |

### Data Flow

```
📱 User takes garment photo
  → expo-image-manipulator compresses (1200px, JPEG 80%)
  → tRPC mutation: garment.upload (multipart FormData)
    → 🖥️ Server stores original in /data/images/{userId}/garments/
    → 🖥️ Server calls Replicate RMBG-2.0 for background removal
    → 🖥️ Server stores cutout as {garmentId}_cutout.png
    → 🖥️ Server saves metadata to PostgreSQL (garments table)
  ← tRPC returns garment metadata
  → 📱 TanStack Query cache updated, wardrobe grid refreshes

📱 User taps "Try On"
  → tRPC mutation: tryon.requestRender
    → 🖥️ Server checks credits/subscription (subscriptionManager)
    → 🖥️ Server calls TryOnProvider.submitRender (fal.ai or Google)
    → 🖥️ Server stores render job in PostgreSQL (renders table, status: pending)
  ← tRPC returns renderId
  → 📱 Client polls tryon.getRenderStatus every 2s
    → 🖥️ Meanwhile: fal.ai webhook fires → server downloads result → stores image → updates DB status: complete
  ← tRPC returns render result (image URL)
  → 📱 RenderView displays full-screen result
```

## Validation & Completeness Check

### Coherence Validation

All architectural decisions have been reviewed for mutual compatibility:

| Decision Pair | Status | Notes |
|--------------|--------|-------|
| tRPC v11 + Drizzle ORM | ✅ Compatible | Both TypeScript-native, type flow works seamlessly via drizzle-zod |
| NativeWind v5 + Expo SDK 54 | ✅ Compatible | Starter template already integrates both |
| Gluestack UI v3 + NativeWind v4 | ✅ Compatible | Gluestack v3 requires NativeWind v4 (Tailwind v3). v5 causes hard crashes. Starter downgraded to v4 during setup |
| TanStack Query + tRPC v11 | ✅ Compatible | tRPC v11 has built-in TanStack Query integration |
| better-auth + Expo SecureStore | ✅ Compatible | Tokens stored via SecureStore, better-auth handles auth logic |
| Docker Compose + Dokploy + Traefik | ✅ Compatible | Dokploy manages Traefik natively, Docker Compose for service orchestration |
| TryOnProvider abstraction + fal.ai + Google VTO | ✅ Compatible | Both providers implement same interface, switchable via config |
| Apple IAP (StoreKit 2) + better-auth | ✅ Compatible | Subscription state synced to user record via server-side validation |
| MMKV + TanStack Query persist | ✅ Compatible | MMKV is the recommended fast storage adapter for TanStack Query persist |

### Functional Requirements Coverage

**28/28 FRs covered:**

| FR | Description | Covered By |
|----|-------------|-----------|
| FR1 | Account creation + auth | better-auth, Apple Sign-In, auth router |
| FR2 | Body avatar photo | User router, image pipeline |
| FR3 | Update body avatar | User router |
| FR4 | Delete account + data | Auth router, cascading delete pipeline |
| FR5 | Privacy policy consent | (public)/privacy.tsx, first-launch flow |
| FR6 | Add garment (camera) | Garment router, expo-image-picker |
| FR7 | Add garment (gallery) | Garment router, expo-image-picker |
| FR8 | Assign garment category | Garment router, CategoryPills component |
| FR9 | Browse wardrobe offline | TanStack Query persist + MMKV, FlashList |
| FR10 | Remove garment | Garment router, cascading delete |
| FR11 | View stock garments | Pre-bundled assets, garment router |
| FR12 | AI try-on render | TryOnProvider abstraction, tryon router |
| FR13 | View render result | RenderView component, render/[id].tsx |
| FR14 | Retry render (costs credit) | Tryon router, credit deduction |
| FR15 | Quality feedback | FeedbackButton component, tryon router |
| FR16 | Limited categories | GarmentCategory enum, provider.supportedCategories |
| FR17 | 3 free credits | Credits table, account creation logic |
| FR18 | Credit consumption per render | subscriptionManager, tryon middleware |
| FR19 | Weekly subscription | Apple IAP, subscription router |
| FR20 | Apple In-App Purchase | StoreKit 2 Server API, webhooks/apple.ts |
| FR21 | View remaining credits | CreditCounter component, subscription router |
| FR22 | Cancel subscription (iOS) | Standard iOS subscription management |
| FR23 | 3-step onboarding | (onboarding)/ route group |
| FR24 | Stock photos in onboarding | Pre-bundled assets in apps/expo/assets/stock/ |
| FR25 | Replace examples with own photos | User/garment routers, post-onboarding flow |
| FR26 | Local offline cache | TanStack Query persist + MMKV |
| FR27 | Secure server storage | Filesystem + auth-gated serving |
| FR28 | HTTPS encryption | Traefik auto HTTPS (Let's Encrypt) |

### Non-Functional Requirements Coverage

| NFR | Target | Covered By |
|-----|--------|-----------|
| UI < 300ms | FlashList cell recycling, MMKV fast reads, optimistic updates |
| AI render 5-10s | TryOnProvider with 30s timeout, polling pattern |
| First try-on < 60s | Pre-bundled stock photos, ephemeral token (no account gate) |
| Offline browsing | TanStack Query persist + MMKV + expo-image cache |
| HTTPS everywhere | Traefik auto HTTPS via Dokploy |
| No public image URLs | Auth-gated /api/images/{imageId} endpoint |
| Secure token storage | Expo SecureStore (iOS Keychain) |
| Full account deletion | Cascading delete pipeline documented |
| Auth on all endpoints | tRPC auth middleware, ephemeral token for onboarding |
| MVP scalability | Docker Compose, external AI inference, architecture allows horizontal scaling |
| External AI resilience | TryOnProvider abstraction, timeout handling, credit not consumed on failure |

### Gaps & Risks Identified

**Resolved during validation:**

1. ~~**Gluestack UI v3 + NativeWind v5 compatibility**~~ — **RESOLVED**: Gluestack v3 is incompatible with NativeWind v5 (hard crash: `cssInterop` removed, `tailwindcss/resolveConfig` removed). Decision: downgrade to NativeWind v4 + Tailwind CSS v3. Architecture updated accordingly.
2. ~~**Webhook security**~~ — **RESOLVED**: Both services have documented verification. fal.ai: ED25519 signature via `X-Fal-Webhook-Signature` header, keys from JWKS endpoint, library `libsodium-wrappers`. Apple: JWS with x5c certificate chain, library `@apple/app-store-server-library` (official). Implementation details documented for stories.

**Minor (acceptable for MVP, address as needed):**

3. **Rate limiting** — Not yet specified for API endpoints. Add basic rate limiting middleware if abuse detected.
4. **Image serving performance** — Direct filesystem serving may need optimization at scale. Monitor and add CDN layer if needed.
5. **Database schema detail** — Column-level schema not fully specified in architecture. Drizzle schema-as-code will be the source of truth; detailed schema defined during implementation.

### Validation Confidence

**Overall confidence: HIGH**

The architecture document provides clear, unambiguous decisions for all critical areas. All 28 functional requirements are mapped to specific components, routes, and services. The TryOnProvider abstraction enables flexible AI inference with both fal.ai and Google Vertex AI from day one. The monorepo structure with tRPC ensures end-to-end type safety as requested. One compatibility concern (Gluestack v3 + NativeWind v5) is documented with a clear fallback path.
