---
project_name: 'wearbloom'
user_name: 'Axel'
date: '2026-02-15'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 55
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|-----------|---------|-------|
| TypeScript | 5.9.3 | Strict mode, `noUncheckedIndexedAccess`, `module: "Preserve"` |
| React | 19.1.4 | React Compiler enabled (`reactCompiler: true`) |
| React Native | 0.81.5 | New Architecture enabled |
| Expo SDK | 54.0.20 | Managed workflow, typed routes, tsconfigPaths |
| Expo Router | 6.0.13 | File-based routing |
| tRPC | 11.7.1 | Standalone HTTP server adapter, superjson transformer |
| Drizzle ORM | 0.45.1 | `casing: "snake_case"`, postgres-js driver |
| drizzle-zod | 0.8.3 | Schema-to-Zod generation |
| PostgreSQL | 16 (Alpine) | Docker container, local dev via docker-compose |
| better-auth | 1.4.0-beta.9 | + @better-auth/expo for mobile |
| Zod | 4.1.12 (v4) | **CRITICAL: Import from `"zod/v4"`, NOT `"zod"`** |
| NativeWind | 4.1.23 | Tailwind CSS v3.4.17 — **NOT v5 (crashes with Gluestack v3)** |
| Gluestack UI | 3.0.12 | Unstyled components, requires NativeWind v4 |
| TanStack Query | 5.90.8 | Via tRPC integration, persist with MMKV planned |
| Bun | Latest stable | Server runtime + `bun test` runner |
| pnpm | 10.19.0 | Package manager (NOT bun pm, NOT npm) |
| Turborepo | 2.5.8+ | Task orchestration and caching |
| pino | 9.6.0 | Structured JSON logging (server) |
| superjson | 2.2.3 | tRPC serialization transformer |
| @legendapp/list | 2.0.14 | High-perf list (FlashList replacement) |
| @paralleldrive/cuid2 | 2.2.2 | ID generation |
| tailwind-merge | 3.3.1 | `cn()` utility in @acme/ui |

### Version Constraints

- **Gluestack UI v3 + NativeWind v4 are locked together.** NativeWind v5 causes hard crashes (`cssInterop` removed, `tailwindcss/resolveConfig` removed). Never upgrade NativeWind without verifying Gluestack compatibility.
- **Zod v4 breaking change.** The entire monorepo uses Zod v4 (`"zod/v4"` imports). Zod v3 API is different. Never import from `"zod"` directly.
- **better-auth is on beta** (1.4.0-beta.9). API may change between minor versions. Pin exact version in catalog.
- **Bun runtime for server only.** Expo app uses Metro bundler. Never assume Bun APIs are available in client code.

## Critical Implementation Rules

### Language-Specific Rules (TypeScript)

**Zod v4 Import Path:**
- ALWAYS import from `"zod/v4"`, never from `"zod"`. The entire monorepo uses Zod v4 which has different API from v3.
- `ZodError` import: `import { ZodError } from "zod/v4";`
- Zod v4 uses `z.url()` instead of `z.string().url()` for URL validation

**Type Imports (ESLint enforced):**
- Use `import type { Foo }` for type-only imports (separate-type-imports style)
- ESLint rule: `@typescript-eslint/consistent-type-imports` with `prefer: "type-imports"` and `fixStyle: "separate-type-imports"`
- Import order enforced by Prettier: React/RN → Expo → third-party → `@acme/*` → local `~/` → relative

**Environment Variables:**
- NEVER access `process.env` directly in application code. ESLint `restrictEnvAccess` rule blocks it.
- Use validated env module: `import { env } from "./env"` (server) or equivalent
- Only `env.ts` files are exempt from this rule
- Env schemas use Zod v4 for runtime validation

**Strict TypeScript:**
- `strict: true` + `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined`
- `no-non-null-assertion` is an ESLint error — never use `!` post-fix operator
- `no-unnecessary-condition` enforced — no redundant null checks on non-nullable types
- `checksVoidReturn: { attributes: false }` — async event handlers in JSX are allowed

**Module System:**
- All packages use `"type": "module"` (ESM)
- `module: "Preserve"` in tsconfig — bundler handles module resolution
- `moduleResolution: "Bundler"` — use package.json `exports` field, not index files

**Error Handling Pattern:**
- Server errors: Always use `TRPCError` with specific codes, never generic `throw new Error()`
- Business error codes go in `message` field: `INSUFFICIENT_CREDITS`, `RENDER_FAILED`, etc.
- Client Zod errors are automatically formatted via tRPC `errorFormatter` (extracts `zodError`)

**ID Generation:**
- Use `cuid2` for all entity IDs (string type, not auto-increment integers)
- Import from `@paralleldrive/cuid2`

### Framework-Specific Rules

**Monorepo Structure (@acme/* namespace):**
- All internal packages use `@acme/` prefix: `@acme/api`, `@acme/db`, `@acme/auth`, `@acme/ui`, `@acme/validators`
- Apps: `@acme/expo` (mobile), `@acme/server` (backend)
- Tooling: `@acme/eslint-config`, `@acme/prettier-config`, `@acme/tsconfig`, `@acme/tailwind-config`
- Dependencies between packages via `"workspace:*"` in package.json
- Version catalog in `pnpm-workspace.yaml` — shared dependency versions use `catalog:` syntax

**tRPC Patterns:**
- Sub-routers use `satisfies TRPCRouterRecord` pattern (flat record of procedures)
- Root router merges sub-routers via `createTRPCRouter({ auth: authRouter, ... })`
- Two procedure types: `publicProcedure` (no auth) and `protectedProcedure` (auth required)
- Context provides `{ db, session }` — session is `null` when unauthenticated
- Server uses standalone HTTP adapter: `createHTTPServer` from `@trpc/server/adapters/standalone`
- Client uses `createTRPCOptionsProxy` with `httpBatchLink` + `loggerLink`
- Custom header `x-trpc-source: "expo-react"` sent on all requests

**Drizzle ORM Patterns:**
- Schema uses callback-style API: `pgTable("name", (t) => ({ ... }))`
- `casing: "snake_case"` in BOTH `drizzle()` client AND `drizzle.config.ts` — write camelCase in TypeScript, Drizzle maps to snake_case SQL automatically. Never use explicit column name strings (e.g. `t.text("user_id")`) — let casing handle it.
- Foreign keys with `onDelete: "cascade"` for referential integrity
- Access via `@acme/db/client` (drizzle instance), `@acme/db/schema` (tables), `@acme/db` (utilities like `alias`, `sql`)

**Expo / React Native Patterns:**
- Path alias `~/` maps to `./src/*` in Expo app (tsconfig paths)
- Route files live in `apps/expo/src/app/` (NOT `apps/expo/app/`)
- Layout groups: `(auth)`, `(onboarding)`, `(public)` for route protection
- Styles via NativeWind classes (Tailwind CSS syntax on React Native components)
- `className` prop available on all RN core components via NativeWind. For third-party components, use `remapProps` if needed.
- Use `SafeAreaView` from `react-native-safe-area-context` for screen containers
- CSS imported in root layout: `import "../styles.css"`

**better-auth Patterns:**
- Server: `initAuth()` factory pattern in `@acme/auth` — configurable per environment
- Client: `createAuthClient()` with `expoClient` plugin in `apps/expo/src/utils/auth.ts`
- Token storage: `expo-secure-store` (iOS Keychain) — plugin handles secure cookie management and adds them to request headers automatically
- Session token stored under key `"session_token"` via `session-store.ts` helper
- Trusted origins include `"expo://"` for deep linking

**Gluestack UI v3 Patterns:**
- Gluestack UI v3 is a **copy-paste component system**, not a traditional npm package
- `@gluestack-ui/core` provides unstyled headless components with ARIA support
- Use `tva` (Tailwind Variants Adapter) from `@gluestack-ui/utils/nativewind-utils` for type-safe variant styling — preferred over manual `Record<Variant, string>` maps
- `cn()` utility in `@acme/ui` for class merging (uses `tailwind-merge`)
- Theme colors defined in `tooling/tailwind/index.ts` AND `packages/ui/src/gluestack-config.ts` (keep in sync)
- Primary palette: indigo-based (#4c6ef5 → #364fc7), Neutral: gray scale

**State Management:**
- Server state: TanStack Query via tRPC integration (automatic)
- Local state: `useState`/`useReducer` + Context — no global store (Redux, Zustand, etc.)
- NEVER use `useState` for loading/error states — use TanStack Query states (`isLoading`, `isFetching`, `isError`, `isPending`)

**Logging (Server):**
- Use `pino` for all server logging — structured JSON output
- Logger instance: `pino({ name: "wearbloom-server" })`
- Never use `console.log` in server code — use `logger.info()`, `logger.error()`, etc.

### Testing Rules

**Methodology: TDD (Test-Driven Development):**
- Write failing tests FIRST, then implement to make them pass
- Red → Green → Refactor cycle for all new features
- Tests are the specification — write them from acceptance criteria before touching implementation code

**Test Runner: `bun test`**
- Import all test utilities from `"bun:test"`: `describe`, `test`, `expect`, `mock`, `spyOn`, `beforeEach`, `afterEach`
- NEVER import from `"vitest"`, `"@jest/globals"`, or `"jest"` packages
- `jest.fn()` and `vi.fn()` are available from `"bun:test"` as compatibility aliases — but prefer `mock()` directly

**Test Location: Co-located with source files:**
- Place `{source}.test.{ts,tsx}` next to the source file it tests
- NEVER create a separate `__tests__/` or `tests/` directory

**Running Tests:**
- Single package: `bun test` from package directory
- All packages: `turbo test` from root
- Specific file: `bun test src/services/imageProcessor.test.ts`
- Coverage: `bun test --coverage`
- Watch: `bun test --watch`

**Mocking — Critical `bun test` Behaviors:**

1. **`mock.module()` is IRREVERSIBLE** — `mock.restore()` does NOT undo module mocks (confirmed by Bun docs). Once a module is mocked, it stays mocked for the entire test file.
2. **`mock.module()` updates ESM live bindings** — unlike Jest, you can call `mock.module()` even after a static `import` and the binding is updated. But side effects from the original module will have already fired.
3. **Use `--preload` for third-party modules with side effects** (`resend`, DB clients, SDK inits, etc.) — ensures mocks are in place before any module evaluation:

```toml
# bunfig.toml
[test]
preload = ["./test/setup.ts"]
```

```typescript
// test/setup.ts — loaded before any test file
import { mock } from "bun:test";
mock.module("resend", () => ({
  Resend: mock(() => ({
    emails: { send: mock(() => Promise.resolve({ id: "mock-id" })) },
  })),
}));
```

4. **Use dependency injection for first-party modules** — since `mock.module()` is irreversible, prefer DI for testable service design:

```typescript
// ✅ CORRECT: dependency injection
const service = createGarmentService({ imageProcessor: mockProcessor });

// ❌ WRONG: mock.module for first-party expecting per-test reset
mock.module("../services/imageProcessor", () => ({ ... }));
```

5. **`spyOn` + `mockRestore()` in `afterEach`** for object/class methods — spies restore cleanly, unlike module mocks.

6. **Never mutate shared state between test files** — Bun runs all files in a single process. Exported objects, singletons, and module-level state leak across files. Use `spyOn` for reversible overrides.

**Mocking Patterns Summary:**

| Pattern | Syntax | Reversible? |
|---------|--------|-------------|
| Mock module | `mock.module("path", () => ({ ... }))` | NO — irreversible |
| Mock function | `mock(() => value)` | Yes (new per call) |
| Spy on method | `spyOn(object, "method")` | Yes (`mockRestore()`) |
| Fake timers | `mock.setSystemTime(new Date(...))` | Yes |
| Reset all spies | `mock.restore()` | Yes (spies only, NOT modules) |
| Preload mocks | `--preload ./test/setup.ts` | N/A (runs once before all) |

**Test Structure:**
- Each package has `"test": "bun test"` in package.json
- Turborepo orchestrates via `turbo test` and caches results

### Code Quality & Style Rules

**Prettier Configuration (enforced via @acme/prettier-config):**
- Import sorting automated by `@ianvs/prettier-plugin-sort-imports`:
  1. `<TYPES>` (type-only imports first)
  2. `react` / `react-native`
  3. `expo`
  4. Third-party modules
  5. `@acme/*` packages (gap before)
  6. Local `~/` imports (gap before)
  7. Relative `../` and `./` imports
- Tailwind class sorting via `prettier-plugin-tailwindcss`
- Tailwind functions recognized: `cn`, `cva`
- Never manually sort imports — Prettier handles it on save

**ESLint Configuration (enforced via @acme/eslint-config):**
- TypeScript strict type-checking: `recommendedTypeChecked` + `stylisticTypeChecked`
- `no-unused-vars` with `_` prefix exception: `argsIgnorePattern: "^_"`, `varsIgnorePattern: "^_"`
- `consistent-type-imports`: type imports must use `import type` syntax
- `no-non-null-assertion`: error — never use `!` operator
- `no-unnecessary-condition`: error — no dead code checks on non-nullable types
- `import/consistent-type-specifier-style`: `"prefer-top-level"` — type specifiers at import level
- `restrictEnvAccess` rule: blocks `process.env` access outside `env.ts` files
- Expo config ignores: `.expo/**`, `expo-plugins/**`

**react-doctor (React health checker):**
- Static analysis tool checking 60+ rules: React Compiler compatibility, state & effects, performance, architecture, dead code, accessibility
- Auto-detects framework (React Native), React version (19), TypeScript, and React Compiler
- Run locally: `npx react-doctor apps/expo -y --verbose`
- Run score-only: `npx react-doctor apps/expo -y --score`
- CI enforced: runs on every PR alongside lint/format/typecheck
- Config: `react-doctor.config.json` at project root (optional — for ignoring specific rules)
- Docs: https://github.com/millionco/react-doctor

**Naming Conventions:**

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `getUserGarments`, `renderResult` |
| React components | PascalCase | `WardrobeGrid`, `GarmentCard` |
| Types, interfaces | PascalCase | `TryOnResult`, `GarmentCategory` |
| Component files | PascalCase.tsx | `WardrobeGrid.tsx`, `PaywallScreen.tsx` |
| Utility files | camelCase.ts | `imageCompressor.ts`, `authUtils.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FREE_CREDITS`, `RENDER_TIMEOUT_MS` |
| Zod schemas | camelCase + Schema suffix | `garmentCreateSchema`, `userProfileSchema` |
| tRPC routers | camelCase + Router suffix | `garmentRouter`, `tryonRouter` |
| tRPC procedures | verb.noun pattern | `garment.upload`, `tryon.requestRender` |
| DB tables (SQL) | snake_case, plural | `users`, `garments`, `try_on_renders` |
| DB columns (SQL) | snake_case | `user_id`, `created_at` |
| DB columns (TS) | camelCase | `userId`, `createdAt` (Drizzle maps automatically) |
| Route files (Expo) | camelCase or kebab-case | `index.tsx`, `step1.tsx` |
| Layout groups | (name) | `(auth)`, `(onboarding)`, `(public)` |
| Dynamic routes | [param].tsx | `garment/[id].tsx` |

**Code Organization:**
- Components organized by domain: `components/garment/`, `components/tryon/`, `components/subscription/`
- Shared UI primitives in `components/ui/` (Gluestack wrappers)
- Common cross-domain components in `components/common/`
- NEVER place new components at the root of `components/`
- Custom hooks in `hooks/` directory
- Utilities in `utils/` directory
- Constants in `constants/` directory

### Development Workflow Rules

**Package Manager:**
- ALWAYS use `pnpm` — never `npm`, `yarn`, or `bun install`
- Add dependencies: `pnpm add <pkg> --filter @acme/<package>`
- Add dev dependencies: `pnpm add -D <pkg> --filter @acme/<package>`
- Shared versions: use `catalog:` in package.json, define version in `pnpm-workspace.yaml` catalog
- Install all: `pnpm install` from root
- Lockfile: `pnpm-lock.yaml` — always commit, never delete

**Turborepo Commands (from root):**
- `pnpm dev` — watch mode for all packages
- `pnpm dev:expo` — Expo app + dependencies only
- `pnpm dev:server` — server + dependencies only
- `pnpm lint` / `pnpm lint:fix` — ESLint across all packages
- `pnpm format` / `pnpm format:fix` — Prettier across all packages
- `pnpm typecheck` — TypeScript check across all packages
- `pnpm db:push` — push Drizzle schema to PostgreSQL
- `pnpm db:studio` — open Drizzle Studio

**Database Workflow:**
- Local dev: `docker compose up -d` starts PostgreSQL on port 5432
- Credentials: `postgres`/`postgres`, database `wearbloom`
- Schema changes: edit `packages/db/src/schema.ts`, then `pnpm db:push`
- Production: use migration files via `drizzle-kit`
- Environment: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wearbloom`

**Deployment:**
- Server: Docker container (`oven/bun:1-alpine` base) → Dokploy on VPS
- Mobile: EAS Build → TestFlight (no Mac required)
- CI/CD: GitHub Actions for both server and mobile builds
- Secrets: Dokploy secrets (server), EAS secrets (mobile)
- Health check: `GET /health` on server returns `{ status: "ok", timestamp: ... }`

**Dev Client on iPhone (WSL — no Mac needed):**
- Build the dev client (once, or when native plugins change):
  `cd apps/expo && npx eas-cli build --profile development --platform ios`
- Install on iPhone via the link/QR EAS provides after build
- Start Metro each dev session:
  `cd apps/expo && pnpm expo start --dev-client --tunnel`
- Open the app on iPhone → scan QR from terminal → hot reload active
- Requires `@expo/ngrok` for tunnel mode: `pnpm add -D @expo/ngrok --filter @acme/expo`
- Dev mode points to VPS (`api.wearbloom.app`), not a local server

**Git Workflow:**
- Main branch: `main`
- Feature branches from `main`
- Run `pnpm lint` and `pnpm typecheck` before committing
- Commit messages: conventional commits style (feat:, fix:, chore:, etc.)

### Critical Don't-Miss Rules

**Anti-Patterns (NEVER do this):**

```typescript
// ❌ WRONG: loading state with useState
const [loading, setLoading] = useState(false);

// ✅ CORRECT: TanStack Query mutation
const mutation = api.garment.upload.useMutation();
// mutation.isPending gives you the loading state

// ❌ WRONG: generic error
throw new Error('Something went wrong');

// ✅ CORRECT: typed TRPCError
throw new TRPCError({ code: 'BAD_REQUEST', message: 'IMAGE_TOO_LARGE' });

// ❌ WRONG: direct provider call in router
const result = await fal.subscribe("fal-ai/fashn/tryon/v1.6", { ... });

// ✅ CORRECT: through TryOnProvider abstraction
const provider = getTryOnProvider(config.activeProvider);
const result = await provider.submitRender(personImage, garmentImage);

// ❌ WRONG: import Zod from "zod"
import { z } from "zod";

// ✅ CORRECT: import Zod v4
import { z } from "zod/v4";

// ❌ WRONG: process.env in application code
const dbUrl = process.env.DATABASE_URL;

// ✅ CORRECT: validated env module
import { env } from "./env";
const dbUrl = env.DATABASE_URL;

// ❌ WRONG: explicit column name with casing enabled
const users = pgTable("users", (t) => ({
  userId: t.text("user_id").primaryKey(),  // redundant!
}));

// ✅ CORRECT: let Drizzle casing handle it
const users = pgTable("users", (t) => ({
  userId: t.text().primaryKey(),  // maps to "user_id" automatically
}));

// ❌ WRONG: console.log on server
console.log("User created:", user);

// ✅ CORRECT: pino logger
logger.info({ userId: user.id }, "User created");

// ❌ WRONG: npm/yarn commands
// npm install lodash / yarn add lodash

// ✅ CORRECT: pnpm with filter
// pnpm add lodash --filter @acme/api

// ❌ WRONG: auto-increment integer IDs
// id: t.serial("id").primaryKey(),

// ✅ CORRECT: cuid2 string IDs
// id: t.text().primaryKey().$defaultFn(() => createId()),

// ❌ WRONG: separate __tests__ directory
// src/__tests__/imageProcessor.test.ts

// ✅ CORRECT: co-located test
// src/services/imageProcessor.test.ts

// ❌ WRONG: import test utils from vitest/jest
// import { describe, it } from "vitest";

// ✅ CORRECT: import from bun:test
// import { describe, test, expect } from "bun:test";
```

**Architecture Boundaries — NEVER cross these:**
- Expo app NEVER accesses the database directly — always through tRPC
- tRPC routers NEVER call external APIs directly — always through service layer
- AI inference NEVER called outside `TryOnProvider` abstraction
- Images NEVER served with public URLs — always auth-gated endpoint
- Credits NEVER deducted on failed renders — only on success

**Business Error Codes (exhaustive list):**

| Code | HTTP Code | When | Credit consumed? |
|------|-----------|------|-----------------|
| `INSUFFICIENT_CREDITS` | FORBIDDEN | Free user, zero renders left | No |
| `RENDER_FAILED` | INTERNAL_SERVER_ERROR | AI inference returned error | No |
| `RENDER_TIMEOUT` | TIMEOUT | 30s timeout exceeded | No |
| `INVALID_CATEGORY` | BAD_REQUEST | Garment category not supported | No |
| `SUBSCRIPTION_EXPIRED` | FORBIDDEN | Subscription lapsed | No |
| `IMAGE_TOO_LARGE` | BAD_REQUEST | Photo exceeds size limit | No |

**Security Rules:**
- All image URLs are auth-gated (`/api/images/{imageId}` verifies user ownership)
- Auth tokens stored in iOS Keychain via `expo-secure-store` — never AsyncStorage
- HTTPS enforced via Traefik (Let's Encrypt auto-renewal)
- Apple IAP validation server-side via StoreKit 2 Server API
- Full account deletion cascade: user → photos → avatar → wardrobe → renders → usage history

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge
- Use Context7 (MCP) to look up library documentation when unsure about APIs, syntax, or version-specific behavior
- Search the web when needed — don't hesitate to verify current best practices, check changelogs, or resolve ambiguities

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review periodically for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-02-15
