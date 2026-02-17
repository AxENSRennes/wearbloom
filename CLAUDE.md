# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
pnpm dev                # Watch mode for all packages
pnpm dev:expo           # Expo app + dependencies only
pnpm dev:server         # Server + dependencies only
pnpm lint               # ESLint across all packages
pnpm lint:fix           # ESLint with auto-fix
pnpm format:fix         # Prettier across all packages
pnpm typecheck          # TypeScript check across all packages
pnpm db:push            # Push Drizzle schema to PostgreSQL
pnpm db:studio          # Open Drizzle Studio GUI

docker compose up -d    # Start local PostgreSQL (port 5432, postgres/postgres, db: wearbloom)

bun test                                          # Run tests in current package
bun test packages/api/src/services/credit.test.ts # Run single test file
turbo test                                        # Run tests across all packages

pnpm add <pkg> --filter @acme/<package>    # Add dependency to specific package
pnpm add -D <pkg> --filter @acme/<package> # Add dev dependency
```

Package manager is **pnpm** exclusively. Never use npm, yarn, or bun install.

## Architecture

Turborepo monorepo with pnpm workspaces. All internal packages use `@acme/` prefix.

```
apps/
  expo/       — React Native mobile app (Expo SDK 54, Expo Router, NativeWind)
  server/     — Bun HTTP server (tRPC standalone adapter)
packages/
  api/        — tRPC routers + service layer (business logic lives here)
  db/         — Drizzle ORM schema + client (PostgreSQL)
  auth/       — better-auth setup (server + client configs)
  ui/         — Gluestack UI v3 components (copy-paste pattern with tva styling)
  validators/ — Shared Zod schemas
tooling/      — ESLint, Prettier, TypeScript, Tailwind configs
```

**Data flow:** Expo app → tRPC (`httpBatchLink` + superjson) → routers → service layer → Drizzle → PostgreSQL

**Service injection:** Services (imageStorage, backgroundRemoval, tryOnProvider, appleIap) are injected via `createTRPCContext` in `packages/api/src/trpc.ts`, not imported directly by routers. New features follow this DI pattern.

**Procedure types:** `publicProcedure` (no auth), `protectedProcedure` (auth required), `renderProcedure` (protected + 10 req/min rate limit), `uploadProcedure` (protected + 20 req/min rate limit).

**Server route dispatch:** `/health` → `/api/webhooks/apple` → `/api/webhooks/fal` → `/api/auth/*` → `/api/images/*` → tRPC catch-all.

**TryOnProvider abstraction:** AI inference is behind `TryOnProvider` interface with implementations for fal_fashn, fal_nano_banana, google_vto. New providers implement this interface.

### Key Files

```
packages/db/src/schema.ts        — All DB tables and enums
packages/api/src/trpc.ts         — tRPC context, procedure definitions, DI shape
packages/api/src/root.ts         — Root router (all sub-routers merged)
packages/api/src/router/         — tRPC sub-routers (auth, garment, user, tryon, subscription)
packages/api/src/services/       — Domain services (credit, imageStorage, tryOnProvider, etc.)
apps/server/src/index.ts         — HTTP server entry, route dispatch
apps/server/src/env.ts           — All server environment variables
apps/expo/src/utils/api.tsx      — tRPC client setup
apps/expo/src/app/               — Expo Router file-based routes: (auth)/, (onboarding)/, (public)/
```

### Architecture Boundaries

- Expo app never accesses DB directly — always through tRPC
- tRPC routers never call external APIs directly — always through service layer
- AI inference never called outside `TryOnProvider` abstraction
- Images never served with public URLs — always auth-gated at `/api/images/{imageId}`
- Credits never deducted on failed renders — only on success

## Critical Rules

- **Zod v4:** Always `import { z } from "zod/v4"`, never from `"zod"`. Zod v4 API differs from v3 (e.g. `z.url()` not `z.string().url()`)
- **NativeWind v4 + Gluestack v3 are version-locked.** Do not upgrade either independently
- **No `process.env`:** ESLint blocks it. Use validated env modules (`import { env } from "./env"`)
- **Drizzle casing:** `casing: "snake_case"` maps camelCase TS → snake_case SQL. Never use explicit column names like `t.text("user_id")` — write `t.text()` and let casing handle it
- **TRPCError:** Always `throw new TRPCError({ code: "BAD_REQUEST", message: "IMAGE_TOO_LARGE" })`, never generic `throw new Error()`
- **Logging:** Use `pino` logger (`logger.info()`, `logger.error()`), never `console.log` on server
- **IDs:** `cuid2` string IDs via `t.text().primaryKey().$defaultFn(() => createId())`, never auto-increment
- **Type imports:** Use `import type { Foo }` for type-only imports (ESLint: `separate-type-imports`)
- **Strict TS:** `noUncheckedIndexedAccess` means indexed access returns `T | undefined`
- **No `useState` for loading/error:** Use TanStack Query states (`isPending`, `isError`, `isFetching`) or tRPC mutation states
- **Components by domain:** `components/garment/`, `components/tryon/`, `components/subscription/`. Shared primitives in `components/ui/`. Never place components at root of `components/`
- **Gluestack UI:** Uses `tva` (Tailwind Variants Adapter) for type-safe variant styling, `cn()` for class merging
- **Error codes:** INSUFFICIENT_CREDITS, RENDER_FAILED, RENDER_TIMEOUT, INVALID_CATEGORY, SUBSCRIPTION_EXPIRED, IMAGE_TOO_LARGE. Credits are never consumed on any error
- **Images:** Auth-gated only. Tokens stored in iOS Keychain via `expo-secure-store`, never AsyncStorage

## Testing

Test runner is **`bun test`**. Import from `"bun:test"` only — never vitest, jest, or @jest/globals.

Tests are **co-located** with source: `{source}.test.{ts,tsx}` next to the file it tests. No `__tests__/` directories.

### Bun Mocking Gotchas

- **`mock.module()` is IRREVERSIBLE** — `mock.restore()` does not undo module mocks. Once mocked, stays mocked for the entire test file
- **Prefer DI over `mock.module()` for first-party modules** — services accept dependencies via constructor/factory (see router tests for pattern)
- **`spyOn` + `mockRestore()` in `afterEach`** for object methods — spies restore cleanly, unlike module mocks
- **Use `--preload` in `bunfig.toml`** for third-party modules with side effects (Resend, DB clients) — ensures mocks are in place before module evaluation
- **Bun runs all test files in a single process** — module-level state, singletons, and exported objects leak across files. Use `spyOn` for reversible overrides

| Pattern | Syntax | Reversible? |
|---------|--------|-------------|
| Mock module | `mock.module("path", () => ({ ... }))` | No |
| Mock function | `mock(() => value)` | Yes |
| Spy on method | `spyOn(object, "method")` | Yes (`mockRestore()`) |
| Fake timers | `mock.setSystemTime(new Date(...))` | Yes |
| Reset spies | `mock.restore()` | Spies only, not modules |

## Naming Conventions

- Zod schemas: `camelCase` + `Schema` suffix (`garmentCreateSchema`)
- tRPC routers: `camelCase` + `Router` suffix, procedures as `verb.noun` (`garment.upload`)
- Component files: `PascalCase.tsx`, utility files: `camelCase.ts`
- DB tables (SQL): `snake_case`, plural. DB columns (TS): `camelCase` (Drizzle auto-maps)
