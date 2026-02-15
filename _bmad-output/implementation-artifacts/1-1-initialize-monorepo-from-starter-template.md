# Story 1.1: Initialize Monorepo from Starter Template

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the project initialized from create-t3-turbo with all required modifications,
So that we have a working monorepo foundation for all subsequent development.

## Acceptance Criteria

1. **Given** create-t3-turbo starter **When** initialized with `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo` **Then** monorepo structure is created with apps/ and packages/ directories

2. **Given** the starter template **When** modifications are applied **Then** apps/nextjs/ and apps/tanstack-start/ are removed **And** apps/server/ is added with a standalone tRPC Node.js server entry point and health check endpoint **And** packages/db/ connects to self-hosted PostgreSQL via Drizzle ORM (Supabase removed) **And** packages/ui/ contains Gluestack UI v3 setup (shadcn-ui removed) **And** NativeWind is downgraded to v4 with Tailwind CSS v3 (Gluestack v3 compatibility)

3. **Given** local development setup **When** docker-compose.yml is run **Then** PostgreSQL container starts and is accessible **And** Dockerfile for production server builds and starts successfully

4. **Given** all modifications complete **When** `pnpm install` is run **Then** dependencies install without errors **And** TypeScript compiles cleanly across all packages **And** Expo app launches on device/simulator with a basic screen **And** tRPC server starts and responds at the health check endpoint

## Tasks / Subtasks

- [ ] Task 1: Initialize monorepo from create-t3-turbo (AC: #1)
  - [ ] 1.1 Run `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo` in project root
  - [ ] 1.2 Verify monorepo structure: apps/, packages/, tooling/, turbo.json, pnpm-workspace.yaml
  - [ ] 1.3 Run `pnpm install` to confirm starter installs cleanly before modifications
  - [ ] 1.4 Commit clean starter as baseline (important for tracking modifications)

- [ ] Task 2: Remove unused starter apps (AC: #2)
  - [ ] 2.1 Delete `apps/nextjs/` directory entirely
  - [ ] 2.2 Delete `apps/tanstack-start/` directory entirely
  - [ ] 2.3 Remove references to these apps from turbo.json if present
  - [ ] 2.4 Remove any workspace references in pnpm-workspace.yaml if needed
  - [ ] 2.5 Run `pnpm install` to clean up workspace graph

- [ ] Task 3: Add apps/server/ — standalone tRPC server on Bun (AC: #2, #4)
  - [ ] 3.1 Create `apps/server/` directory structure:
    ```
    apps/server/
      src/
        index.ts          # Entry point (standalone tRPC HTTP server)
        env.ts            # Zod-validated environment variables
      package.json
      tsconfig.json
    ```
  - [ ] 3.2 Create `apps/server/package.json` with dependencies: `@trpc/server`, `@acme/api` (workspace), `@acme/db` (workspace), `zod`, `pino`
  - [ ] 3.3 Create `apps/server/src/env.ts` with Zod-validated env vars: `DATABASE_URL`, `PORT` (default 3000)
  - [ ] 3.4 Create `apps/server/src/index.ts`:
    - Import `createHTTPServer` from `@trpc/server/adapters/standalone`
    - Import `appRouter` from `@acme/api`
    - Add `/health` endpoint returning `{ status: "ok", timestamp: Date }`
    - Listen on configured PORT
    - Log startup with pino
  - [ ] 3.5 Add tsconfig.json extending `@acme/typescript-config/server.json`
  - [ ] 3.6 Add scripts: `"dev": "bun run src/index.ts"`, `"start": "bun run src/index.ts"`, `"test": "bun test"`
  - [ ] 3.7 Verify server starts and `/health` responds with 200

- [ ] Task 4: Replace Supabase with self-hosted PostgreSQL in packages/db/ (AC: #2)
  - [ ] 4.1 Remove Supabase dependency (`@supabase/supabase-js` or similar) from packages/db/
  - [ ] 4.2 Install `postgres` driver (or use `bun:sql` for Bun-native) + `drizzle-orm` (already present)
  - [ ] 4.3 Update `packages/db/src/index.ts` to connect via `DATABASE_URL` env var to PostgreSQL
  - [ ] 4.4 Ensure `drizzle-kit` is in dev dependencies for migrations
  - [ ] 4.5 Create `packages/db/drizzle.config.ts` pointing to local PostgreSQL
  - [ ] 4.6 Create minimal seed schema (at least `users` table placeholder) to verify connection
  - [ ] 4.7 Verify Drizzle can connect and run `drizzle-kit push` against local PostgreSQL

- [ ] Task 5: Replace shadcn-ui with Gluestack UI v3 in packages/ui/ (AC: #2)
  - [ ] 5.1 Remove all shadcn-ui components and dependencies from packages/ui/
  - [ ] 5.2 Install Gluestack UI v3 core: `@gluestack-ui/themed`, `@gluestack-ui/config`
  - [ ] 5.3 Create `packages/ui/src/gluestack-config.ts` with Wearbloom theme tokens
  - [ ] 5.4 Create `packages/ui/src/index.ts` re-exporting base Gluestack components
  - [ ] 5.5 Create minimal Button component (primary/secondary/ghost variants) as proof-of-concept
  - [ ] 5.6 Verify packages/ui/ builds and exports correctly

- [ ] Task 6: Downgrade NativeWind v5 → v4 and Tailwind CSS v4 → v3 (AC: #2)
  - [ ] 6.1 In `apps/expo/`, uninstall `nativewind@5` and `tailwindcss@4`
  - [ ] 6.2 Install `nativewind@4.1` and `tailwindcss@3`
  - [ ] 6.3 Update `apps/expo/tailwind.config.ts` to Tailwind CSS v3 format (module.exports, content array, theme.extend)
  - [ ] 6.4 Update `apps/expo/global.css` for Tailwind v3 directives (`@tailwind base/components/utilities`)
  - [ ] 6.5 Update `apps/expo/metro.config.js` to use NativeWind v4 transformer (`withNativeWind`)
  - [ ] 6.6 Update `apps/expo/babel.config.js` if NativeWind v4 requires babel plugin
  - [ ] 6.7 Update `tooling/tailwind/` shared config to v3 format
  - [ ] 6.8 Verify a basic NativeWind className renders correctly in Expo app

- [ ] Task 7: Add docker-compose.yml for local development (AC: #3)
  - [ ] 7.1 Create `docker-compose.yml` at project root with:
    - PostgreSQL service (postgres:16-alpine, port 5432, volume for data persistence)
    - Environment vars: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
  - [ ] 7.2 Create `.env.example` with all required environment variables
  - [ ] 7.3 Add `.env` to `.gitignore` if not already
  - [ ] 7.4 Verify `docker compose up -d` starts PostgreSQL and it's accessible

- [ ] Task 8: Add Dockerfile for production server (AC: #3)
  - [ ] 8.1 Create `Dockerfile` at project root (or `apps/server/Dockerfile`):
    - Base image: `oven/bun:1-alpine`
    - Multi-stage build: install deps → copy source → run
    - Entry point: `bun run apps/server/src/index.ts`
    - Expose PORT
  - [ ] 8.2 Add `.dockerignore` to exclude node_modules, .git, etc.
  - [ ] 8.3 Verify `docker build` succeeds and container starts with health check passing

- [ ] Task 9: Final validation and cleanup (AC: #4)
  - [ ] 9.1 Run `pnpm install` — must succeed with zero errors
  - [ ] 9.2 Run `pnpm turbo build` or `turbo typecheck` — TypeScript must compile cleanly across ALL packages
  - [ ] 9.3 Start Expo dev server — app must launch showing a basic screen on device/simulator
  - [ ] 9.4 Start tRPC server (`bun run apps/server/src/index.ts`) — must respond at `/health`
  - [ ] 9.5 Verify tRPC client in Expo can connect to server (basic query)
  - [ ] 9.6 Update `package.json` root scripts if needed: `"dev:server"`, `"dev:expo"`, `"db:push"`, `"db:studio"`
  - [ ] 9.7 Clean up any remaining starter boilerplate (example routes, demo components)

## Dev Notes

### Critical Architecture Decisions

**This story establishes the foundation for the ENTIRE project.** Every subsequent story depends on these decisions being implemented correctly. There is ZERO room for deviation from the architecture document.

### Starter Template: create-t3-turbo

- **Command:** `npx create-turbo@latest -e https://github.com/t3-oss/create-t3-turbo`
- **What it provides:** Expo SDK 54 + tRPC v11 + Drizzle ORM + Turborepo + pnpm workspaces + NativeWind v5 (needs downgrade)
- **What it does NOT provide:** apps/server/ (standalone backend), Docker setup, Gluestack UI, correct NativeWind version
- The starter ships with apps/nextjs/ and apps/tanstack-start/ that MUST be removed
- The starter uses Supabase for DB which MUST be replaced with self-hosted PostgreSQL

[Source: architecture.md#Starter Template Evaluation]

### NativeWind v4 Downgrade — CRITICAL

**Gluestack UI v3 is INCOMPATIBLE with NativeWind v5.** This causes hard crashes: missing `cssInterop` + `resolveConfig`. The downgrade to NativeWind v4.1 + Tailwind CSS v3 is MANDATORY.

- NativeWind v4 uses Tailwind CSS v3 config format (`module.exports`, `content` array)
- NativeWind v5 uses Tailwind CSS v4 config format (CSS-based config) — completely different
- The Gluestack team has confirmed v3 works with NativeWind v4. A future Gluestack v4 will support NativeWind v5
- Use the `gluestack-expo-nativewind-v4-template` as reference for correct setup

[Source: architecture.md#Coherence Validation, web research Feb 2026]

### Server Runtime: Bun

- The server runs on **Bun** runtime (not Node.js), base Docker image: `oven/bun:1-alpine`
- Bun executes TypeScript natively — no build step in dev, near-instant startup
- pnpm remains the package manager (Bun PM migration blocked by known bug)
- `bun test` is the test runner across all packages
- Bun implements Node.js APIs — tRPC standalone adapter works without modification

[Source: architecture.md#Architectural Decisions Provided by Starter]

### tRPC v11 Standalone Server

- Use `@trpc/server/adapters/standalone` with `createHTTPServer`
- The server is a standalone HTTP server, NOT Express or Fastify
- Health check at `/health` is a plain HTTP handler, not a tRPC procedure
- Domain-based routers will be added in later stories: auth, garment, tryon, subscription, user
- For this story, a minimal `appRouter` with a placeholder procedure is sufficient

[Source: architecture.md#API & Communication Patterns]

### Database: Self-hosted PostgreSQL via Drizzle

- Replace Supabase connection with direct PostgreSQL connection
- Use `postgres` driver or Bun-native `bun:sql` (via `drizzle-orm/bun-sql`)
- Drizzle ORM v0.45.x — stable, NOT the v1.0 beta
- Schema-as-TypeScript code in `packages/db/src/schema/`
- drizzle-kit for migrations: `drizzle-kit push` for dev, migration files for production
- Database naming: snake_case tables/columns, plural table names
- IDs: string (cuid2), NEVER auto-increment integers

[Source: architecture.md#Data Architecture]

### Gluestack UI v3 Setup

- Replaces shadcn-ui from the starter template
- Unstyled, accessible components themed with NativeWind classes
- Components go in `packages/ui/src/components/`
- For this story, minimal setup is sufficient — just verify the package builds and exports
- Full design system tokens (colors, typography, spacing) will be implemented in Story 1.2

[Source: architecture.md#Frontend Architecture]

### Docker Setup

- `docker-compose.yml` at project root:
  - PostgreSQL 16 (alpine) on port 5432
  - Persistent volume for data
- `Dockerfile` for production:
  - Base: `oven/bun:1-alpine`
  - Multi-stage build for minimal image size
  - The Dockerfile builds the entire monorepo and runs the server

[Source: architecture.md#Infrastructure & Deployment]

### Verified Technology Versions (Feb 2026)

| Technology | Version | Notes |
|-----------|---------|-------|
| Expo SDK | 54 | Stable, included in create-t3-turbo |
| React Native | 0.81 | With React 19 |
| tRPC | 11.10.0 | Latest stable |
| Drizzle ORM | 0.45.1 | Stable — do NOT use v1.0 beta |
| NativeWind | 4.1.x | MUST downgrade from starter's v5 |
| Tailwind CSS | 3.x | MUST downgrade from starter's v4 |
| Gluestack UI | v3 | Requires NativeWind v4 |
| Bun | 1.3.9 | Latest stable |
| better-auth | 1.4.18 | Latest — not needed this story but verified |
| Turborepo | 2.8.3 | From starter |
| pnpm | Latest | Package manager — NOT Bun PM |

### Project Structure Notes

Target directory structure after this story:

```
wearbloom/
  apps/
    expo/              # Expo SDK 54, tRPC client, NativeWind v4
    server/            # tRPC standalone server (Bun) → Docker → Dokploy
  packages/
    api/               # tRPC router definitions (shared types)
    auth/              # better-auth (placeholder for now)
    db/                # Drizzle ORM + PostgreSQL self-hosted
    ui/                # Gluestack UI v3 components (replaces shadcn-ui)
    validators/        # Shared Zod schemas
  tooling/
    eslint/            # Shared ESLint config
    prettier/          # Shared Prettier config
    tailwind/          # Shared Tailwind CSS v3 config
    typescript/        # Shared TSConfig presets
  turbo.json
  pnpm-workspace.yaml
  docker-compose.yml   # PostgreSQL (local dev)
  Dockerfile           # Production build for Dokploy
  .env.example
```

- Alignment with architecture document: EXACT match required
- `apps/nextjs/` and `apps/tanstack-start/` MUST NOT exist after this story
- `apps/server/` MUST be added
- `packages/db/` connects to PostgreSQL (NOT Supabase)
- `packages/ui/` uses Gluestack UI v3 (NOT shadcn-ui)
- All Tailwind config uses v3 format (NOT v4)

### Key Pitfalls to Avoid

1. **DO NOT skip the NativeWind downgrade.** The app will crash at runtime with Gluestack v3 + NativeWind v5. This is the #1 risk in this story.

2. **DO NOT use Supabase for any database connection.** The architecture requires self-hosted PostgreSQL. Remove ALL Supabase references.

3. **DO NOT use auto-increment IDs.** All IDs must be string (cuid2). Install `@paralleldrive/cuid2`.

4. **DO NOT create a separate `__tests__/` directory.** Tests are co-located with source files. This is enforced across the entire project.

5. **DO NOT use Node.js as the server runtime.** The server runs on Bun. Use `oven/bun:1-alpine` as Docker base image.

6. **DO NOT use `jest` or `vitest` packages directly.** Use `bun test` with imports from `bun:test`.

7. **DO NOT add full business logic in this story.** This is infrastructure setup only. Placeholder routers and minimal schemas are sufficient.

8. **DO NOT change pnpm to another package manager.** pnpm is required by create-t3-turbo.

### Environment Variables Required

```
# .env (local development)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wearbloom
PORT=3000
```

### References

- [Source: architecture.md#Starter Template Evaluation] — Starter selection and rationale
- [Source: architecture.md#Required Modifications from Base Starter] — 7 required modifications
- [Source: architecture.md#Code Organization] — Target directory structure
- [Source: architecture.md#Data Architecture] — PostgreSQL + Drizzle decisions
- [Source: architecture.md#Frontend Architecture] — NativeWind v4 + Gluestack UI v3
- [Source: architecture.md#Infrastructure & Deployment] — Docker + Bun + Dokploy
- [Source: architecture.md#Naming Patterns] — All naming conventions
- [Source: architecture.md#Structure Patterns] — Test co-location, bun test patterns
- [Source: architecture.md#Coherence Validation] — NativeWind v5/Gluestack v3 incompatibility
- [Source: epics.md#Story 1.1] — Story definition and acceptance criteria
- [Source: prd.md#Technical Architecture] — High-level tech decisions
- [Source: ux-design-specification.md#Design System Foundation] — NativeWind v4 + Gluestack rationale

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
