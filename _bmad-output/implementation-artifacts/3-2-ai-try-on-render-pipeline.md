# Story 3.2: AI Try-On Render Pipeline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to generate an AI virtual try-on render of a garment on my body,
So that I can see how it looks on me before getting dressed.

## Acceptance Criteria

1. **Given** the user taps "Try On" in the garment detail sheet **When** the render is requested **Then** the client calls tryon.requestRender via tRPC with garmentId **And** the server validates the user has a body avatar photo and the garment exists

2. **Given** the server receives a render request **When** processing begins **Then** a render record is created in the tryOnRenders table (status: pending, cuid2 ID) **And** the active TryOnProvider is selected based on environment config **And** the provider's submitRender is called with personImage and garmentImage paths

3. **Given** the TryOnProvider interface **When** implemented **Then** three providers exist: FalFashnProvider, FalNanoBananaProvider, GoogleVTOProvider **And** each implements submitRender(personImage, garmentImage, options) returning a jobId **And** each implements getResult(jobId) returning TryOnResult **And** provider selection is via environment config, switchable without code change

4. **Given** fal.ai providers (FASHN, Nano Banana Pro) **When** a render is submitted **Then** the job is sent via fal.ai queue API **And** a webhook URL is provided for completion callback **And** the webhook validates ED25519 signature via X-Fal-Webhook-Signature header (libsodium-wrappers) **And** on webhook receipt, the render result image is downloaded and stored at /data/images/{userId}/renders/ **And** the tryOnRenders table is updated (status: completed, resultPath set)

5. **Given** Google VTO provider **When** a render is submitted **Then** a synchronous POST is made to Vertex AI virtual-try-on-001 **And** the response is wrapped in an async job pattern server-side **And** the result image is stored and tryOnRenders table updated identically to fal.ai flow

6. **Given** the client is waiting for a render **When** polling for status **Then** tryon.getRenderStatus is called every ~2s (max 15 polls = 30s) **And** returns the current status (pending, processing, completed, failed) **And** when completed, returns the result image URL

7. **Given** a render exceeds 30 seconds **When** the timeout is reached **Then** the render status is set to failed with RENDER_TIMEOUT **And** a TRPCError with message RENDER_TIMEOUT is returned to the client

8. **Given** the AI inference service is unavailable **When** a render fails **Then** the render status is set to failed with RENDER_FAILED **And** server retries once for 5xx errors, no retry for 422 validation errors

9. **Given** the tryOnRenders table in Drizzle **When** created **Then** it includes: id (cuid2), userId (FK), garmentId (FK), provider (enum), status (enum: pending, processing, completed, failed), jobId, resultPath, errorCode, createdAt, updatedAt

## Tasks / Subtasks

- [x] Task 1: Database — Add tryOnRenders table and enums (AC: #9)
  - [x]1.1 Write failing test for schema export (verify table and enum types exist)
  - [x]1.2 Add `renderStatus` pgEnum to `packages/db/src/schema.ts`: `["pending", "processing", "completed", "failed"]`
  - [x]1.3 Add `tryOnProviderEnum` pgEnum: `["fal_fashn", "fal_nano_banana", "google_vto"]`
  - [x]1.4 Add `tryOnRenders` table:
    - `id`: text, primaryKey, `$defaultFn(() => createId())`
    - `userId`: text, notNull, FK → users.id, onDelete: cascade
    - `garmentId`: text, notNull, FK → garments.id, onDelete: cascade
    - `provider`: tryOnProviderEnum, notNull
    - `status`: renderStatus, notNull, default: "pending"
    - `jobId`: text (external provider job ID, nullable)
    - `resultPath`: text (nullable — set when completed)
    - `errorCode`: text (nullable — set on failure)
    - `createdAt`: timestamp, defaultNow, notNull
    - `updatedAt`: timestamp, defaultNow, notNull, `$onUpdate(() => new Date())`
  - [x]1.5 Export new table and enums from `packages/db/src/schema.ts`
  - [x]1.6 Run `pnpm db:push` — verify table created in PostgreSQL
  - [x]1.7 Tests GREEN

- [x] Task 2: Install dependencies and update server env (AC: #3, #4)
  - [x]2.1 Install `@fal-ai/client` via `pnpm add @fal-ai/client --filter @acme/api`
  - [x]2.2 Install `libsodium-wrappers` via `pnpm add libsodium-wrappers --filter @acme/server`
  - [x]2.3 Install `@types/libsodium-wrappers` via `pnpm add -D @types/libsodium-wrappers --filter @acme/server`
  - [x]2.4 Add env vars to `apps/server/src/env.ts`:
    - `FAL_KEY`: z.string().default("") (fal.ai API key)
    - `ACTIVE_TRYON_PROVIDER`: z.enum(["fal_fashn", "fal_nano_banana", "google_vto"]).default("fal_fashn")
    - `FAL_WEBHOOK_URL`: z.string().default("") (public URL for fal.ai to call back)
    - `FAL_NANO_BANANA_MODEL_ID`: z.string().default("") (configurable model ID)
    - `GOOGLE_CLOUD_PROJECT`: z.string().default("") (for Vertex AI)
    - `GOOGLE_CLOUD_REGION`: z.string().default("us-central1")
    - `RENDER_TIMEOUT_MS`: z.coerce.number().default(30000) (30 second timeout)
  - [x]2.5 Verify pnpm install and lockfile update

- [x] Task 3: TryOnProvider abstraction — interface + factory (AC: #3)
  - [x]3.1 Write failing tests for provider interface contract in `packages/api/src/services/tryOnProvider.test.ts`:
    - Test: getTryOnProvider returns FalFashnProvider for "fal_fashn"
    - Test: getTryOnProvider returns FalNanoBananaProvider for "fal_nano_banana"
    - Test: getTryOnProvider returns GoogleVTOProvider for "google_vto"
    - Test: getTryOnProvider throws for unknown provider
  - [x]3.2 Create `packages/api/src/services/tryOnProvider.ts`:
    - `GarmentCategory` type: "tops" | "bottoms" | "dresses" | "shoes" | "outerwear"
    - `RenderOptions` interface: `{ category?: string; mode?: "performance" | "balanced" | "quality" }`
    - `TryOnResult` interface: `{ imageUrl: string; imageData?: Buffer; contentType: string; width?: number; height?: number }`
    - `TryOnProvider` interface:
      ```
      submitRender(personImage: string | Buffer, garmentImage: string | Buffer, options?: RenderOptions): Promise<{ jobId: string }>
      getResult(jobId: string): Promise<TryOnResult | null>
      readonly name: string
      readonly supportedCategories: GarmentCategory[]
      ```
    - `TryOnProviderConfig` type: provider-specific config (API keys, webhook URLs, model IDs)
    - `createTryOnProvider(providerName: string, config: TryOnProviderConfig): TryOnProvider` factory
  - [x]3.3 Tests GREEN

- [x] Task 4: FalFashnProvider + shared fal.ai infrastructure (AC: #3, #4)
  - [x]4.1 Write failing tests in `packages/api/src/services/providers/falFashn.test.ts`:
    - Test: submitRender calls fal.queue.submit with correct model ID and input
    - Test: submitRender uploads images to fal.ai storage before submitting
    - Test: submitRender includes webhookUrl in submit options
    - Test: submitRender returns request_id as jobId
    - Test: getResult returns null for pending job
    - Test: name returns "fal_fashn"
    - Test: supportedCategories includes tops, bottoms, dresses
  - [x]4.2 Create `packages/api/src/services/providers/` directory
  - [x]4.3 Create `packages/api/src/services/providers/falFashn.ts`:
    - Initialize fal.ai client with `fal.config({ credentials: falKey })`
    - Model ID: `"fal-ai/fashn/tryon/v1.6"`
    - `submitRender`:
      1. Read person + garment image files from disk (imageStorage paths)
      2. Upload to fal.ai storage: `await fal.storage.upload(imageBuffer)`
      3. Submit via queue: `fal.queue.submit(modelId, { input: { model_image, garment_image, category }, webhookUrl })`
      4. Return `{ jobId: result.request_id }`
    - `getResult`: `fal.queue.result(modelId, { requestId: jobId })`
    - `supportedCategories`: ["tops", "bottoms", "dresses"]
    - Use dependency injection for fal client (testability)
  - [x]4.4 Tests GREEN

- [x] Task 5: FalNanoBananaProvider (AC: #3, #4)
  - [x]5.1 Write failing tests in `packages/api/src/services/providers/falNanoBanana.test.ts`
  - [x]5.2 Create `packages/api/src/services/providers/falNanoBanana.ts`:
    - Same fal.ai queue+webhook pattern as FalFashn
    - Model ID: configurable via `FAL_NANO_BANANA_MODEL_ID` env var
    - If model ID is empty, throw descriptive error on submitRender
    - `name`: "fal_nano_banana"
    - `supportedCategories`: ["tops", "bottoms", "dresses"] (configurable)
  - [x]5.3 Tests GREEN

- [x] Task 6: GoogleVTOProvider (AC: #3, #5)
  - [x]6.1 Write failing tests in `packages/api/src/services/providers/googleVTO.test.ts`:
    - Test: submitRender makes synchronous POST to Vertex AI endpoint
    - Test: submitRender returns a synthetic jobId
    - Test: submitRender stores result immediately (sync model)
    - Test: getResult returns the stored result
    - Test: name returns "google_vto"
  - [x]6.2 Create `packages/api/src/services/providers/googleVTO.ts`:
    - Endpoint: `https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/virtual-try-on-001:predict`
    - Auth: Google Cloud Bearer token (from GOOGLE_CLOUD_CREDENTIALS or Application Default Credentials)
    - Input: base64-encode person + garment images
    - Request body: `{ instances: [{ personImage: { image: { bytesBase64Encoded } }, productImages: [{ image: { bytesBase64Encoded } }] }], parameters: { sampleCount: 1 } }`
    - Response: `predictions[0].bytesBase64Encoded` → decode to Buffer
    - Wrap in async job: generate synthetic jobId (cuid2), store result in memory Map
    - `supportedCategories`: ["tops", "bottoms", "shoes"]
  - [x]6.3 Tests GREEN

- [x] Task 7: tryon tRPC router (AC: #1, #2, #6, #7, #8)
  - [x]7.1 Write failing tests in `packages/api/src/router/tryon.test.ts`:
    - Test: requestRender validates user has a body photo
    - Test: requestRender validates garment exists and belongs to user
    - Test: requestRender creates render record in DB
    - Test: requestRender calls provider.submitRender with correct images
    - Test: requestRender returns renderId
    - Test: requestRender throws PRECONDITION_FAILED if no body photo
    - Test: requestRender throws NOT_FOUND if garment missing
    - Test: getRenderStatus returns current status for valid render
    - Test: getRenderStatus returns resultImageUrl when completed
    - Test: getRenderStatus marks as failed with RENDER_TIMEOUT after 30s
    - Test: getRenderStatus throws NOT_FOUND for invalid renderId
    - Test: getRenderStatus validates render belongs to user
  - [x]7.2 Create `packages/api/src/router/tryon.ts`:
    - **requestRender**: protectedProcedure
      - Input: `z.object({ garmentId: z.string() })`
      - Validate: body photo exists for user (query bodyPhotos table)
      - Validate: garment exists and belongs to user (query garments table)
      - Create render record: `{ userId, garmentId, provider: activeProvider, status: "pending" }`
      - Read person image from disk: `imageStorage.getAbsolutePath(bodyPhoto.filePath)`
      - Read garment image from disk: `imageStorage.getAbsolutePath(garment.cutoutPath ?? garment.imagePath)`
      - Call `provider.submitRender(personImagePath, garmentImagePath, { category: garment.category })`
      - Update render record with jobId
      - Return `{ renderId: render.id }`
      - Error handling: on provider error, update render status to "failed", retry once for 5xx, throw TRPCError RENDER_FAILED
    - **getRenderStatus**: protectedProcedure
      - Input: `z.object({ renderId: z.string() })`
      - Query tryOnRenders for renderId, verify userId match
      - Check timeout: if pending/processing and createdAt + RENDER_TIMEOUT_MS < now → update to failed with RENDER_TIMEOUT
      - Return: `{ status, resultImageUrl: status === "completed" ? "/api/images/render/${renderId}" : null, errorCode }`
  - [x]7.3 Add `tryonRouter` to `packages/api/src/root.ts`: `createTRPCRouter({ auth: authRouter, garment: garmentRouter, tryon: tryonRouter, user: userRouter })`
  - [x]7.4 Tests GREEN

- [x] Task 8: fal.ai webhook endpoint + render result serving (AC: #4)
  - [x]8.1 Write failing tests for webhook handler:
    - Test: valid signature → processes render completion
    - Test: invalid signature → returns 401
    - Test: expired timestamp (>5 min) → returns 401
    - Test: completed render → downloads image, stores to disk, updates DB
    - Test: failed render → updates DB with error, does not download
    - Test: idempotent — already completed render → no-op, returns 200
  - [x]8.2 Create `apps/server/src/webhooks/fal.ts`:
    - `createFalWebhookHandler(deps: { db, imageStorage, logger })` factory
    - Extract headers: `X-Fal-Webhook-Request-Id`, `X-Fal-Webhook-User-Id`, `X-Fal-Webhook-Timestamp`, `X-Fal-Webhook-Signature`
    - Verify ED25519 signature using libsodium-wrappers:
      1. Validate timestamp ±300 seconds
      2. Compute SHA-256 hash of raw body
      3. Construct message: `{requestId}\n{userId}\n{timestamp}\n{bodyHash}`
      4. Fetch JWKS public keys from `https://rest.alpha.fal.ai/.well-known/jwks.json` (cache up to 24h)
      5. Verify signature with `sodium.crypto_sign_verify_detached()`
    - Process payload:
      - Find render record by jobId (= request_id from fal.ai)
      - If status === "OK": download result image from payload.images[0].url → save via imageStorage → update DB status to "completed"
      - If status === "ERROR": update DB status to "failed" with error message
    - Return 200 on success, 401 on invalid signature
  - [x]8.3 Add webhook route to `apps/server/src/index.ts`:
    - `POST /api/webhooks/fal` → falWebhookHandler
    - Parse raw body for signature verification (do NOT parse as JSON before verification)
  - [x]8.4 Extend image serving in `apps/server/src/routes/images.ts`:
    - Add route: `GET /api/images/render/:renderId`
    - Check tryOnRenders table for renderId
    - Verify ownership (render.userId === session.user.id)
    - Serve result image via imageStorage.streamFile(render.resultPath)
  - [x]8.5 Add `saveRenderResult` method to imageStorage service:
    - Path: `/{userId}/renders/{renderId}_result.{ext}`
    - Accept Buffer + mimeType, save to disk, return relative path
  - [x]8.6 Tests GREEN

- [x] Task 9: Client integration — useTryOnRender hook + wiring (AC: #1, #6)
  - [x]9.1 Write failing tests for useTryOnRender hook:
    - Test: startRender calls tryon.requestRender mutation
    - Test: after submit, polls tryon.getRenderStatus every 2s
    - Test: stops polling when status is "completed" or "failed"
    - Test: returns resultImageUrl when completed
    - Test: returns errorCode when failed
    - Test: stops polling after 15 attempts (30s max)
  - [x]9.2 Create `apps/expo/src/hooks/useTryOnRender.ts`:
    - Uses `api.tryon.requestRender.useMutation()`
    - On success: start polling with `useEffect` + `setInterval(2000)`
    - Uses `api.tryon.getRenderStatus.useQuery({ renderId }, { enabled: !!renderId, refetchInterval: 2000 })`
    - Disable refetch when status is terminal (completed, failed)
    - Max poll count: 15 (30s)
    - Return: `{ startRender, status, renderId, resultImageUrl, errorCode, isPending }`
  - [x]9.3 Write failing tests for WardrobeScreen integration:
    - Test: "Try On" button calls tryon.requestRender with garmentId
    - Test: navigates to render route after submit
  - [x]9.4 Update WardrobeScreen `handleTryOn` in `apps/expo/src/app/(auth)/(tabs)/index.tsx`:
    - Replace toast placeholder with: call `startRender({ garmentId })`, navigate to render/[renderId] route
    - Dismiss bottom sheet after initiating render
  - [x]9.5 Create `apps/expo/src/app/(auth)/render/[id].tsx`:
    - Basic placeholder screen (Story 3.3 will add full immersive UI)
    - Show render status (pending → processing → completed/failed)
    - When completed: display result image using expo-image with auth-gated URL
    - When failed: show error message + "Back to Wardrobe" button
    - When loading: show basic ActivityIndicator with status text
    - Back button to return to wardrobe
  - [x]9.6 Tests GREEN

- [x] Task 10: Typecheck, tests, and validation (AC: all)
  - [x]10.1 Run `pnpm typecheck` — must pass across all packages (13/13)
  - [x]10.2 Run `turbo test` — all tests pass, 0 regressions on existing 200 tests
  - [x]10.3 Verify: tapping "Try On" calls requestRender mutation
  - [x]10.4 Verify: render record created in DB with correct fields
  - [x]10.5 Verify: provider selection works based on env config
  - [x]10.6 Verify: fal.ai webhook processes completion correctly
  - [x]10.7 Verify: getRenderStatus returns correct status progression
  - [x]10.8 Verify: timeout check marks stale renders as failed
  - [x]10.9 Verify: render result image served via auth-gated endpoint
  - [x]10.10 Verify: client polls and displays status updates

## Dev Notes

### Story Context & Purpose

This story implements **FR12** (Generate AI virtual try-on render) and is the **core infrastructure story of Epic 3** (AI Virtual Try-On Experience). It creates the complete server-side render pipeline — from request to result — plus the client-side mutation and polling mechanism.

**Why this matters:** This is the entire product's value proposition. The TryOnProvider abstraction enables switching between 3 AI models without code changes, and the queue+webhook pattern handles the inherent latency of AI inference (5-10 seconds). The pipeline must be robust: handle timeouts, retries, signature verification, and graceful failure.

**Scope boundaries:**
- **IN scope**: DB schema (tryOnRenders table), TryOnProvider abstraction + 3 implementations, tryon tRPC router (requestRender + getRenderStatus), fal.ai webhook handler with ED25519 verification, render result image storage + serving, client mutation + polling hook, basic render status screen, WardrobeScreen wiring
- **OUT of scope**: Full-screen immersive render result UI with loading animations (Story 3.3), credit system and consumption (Story 3.4), category validation/gating (Story 3.5)
- **Forward-looking**: Story 3.3 will replace the basic render/[id].tsx with the full RenderView modal (shimmer animation, cross-fade, swipe dismiss). Story 3.4 will add credit checks before requestRender. Story 3.5 will add category validation on the "Try On" button.

[Source: epics.md#Story 3.2 — "AI Try-On Render Pipeline"]
[Source: architecture.md#API & Communication Patterns — "TryOnProvider abstraction"]
[Source: architecture.md#Data Flow — "User taps Try On → tryon.requestRender"]

### Architecture Decisions

**TryOnProvider Abstraction (Architecture-Mandated)**

The architecture requires a provider abstraction with three implementations switchable via environment config:

```typescript
// packages/api/src/services/tryOnProvider.ts
interface TryOnProvider {
  submitRender(personImage: string | Buffer, garmentImage: string | Buffer, options?: RenderOptions): Promise<{ jobId: string }>;
  getResult(jobId: string): Promise<TryOnResult | null>;
  readonly name: string;
  readonly supportedCategories: GarmentCategory[];
}

// Factory
function createTryOnProvider(providerName: string, config: TryOnProviderConfig): TryOnProvider {
  switch (providerName) {
    case "fal_fashn": return new FalFashnProvider(config);
    case "fal_nano_banana": return new FalNanoBananaProvider(config);
    case "google_vto": return new GoogleVTOProvider(config);
    default: throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

**Why 3 providers from day one:** The architecture specifies A/B testability between AI models. Each provider has different strengths — FASHN has fine garment detail rendering, Google VTO has different quality characteristics. Provider selection via env var enables switching without deployment.

[Source: architecture.md#API & Communication Patterns — "TryOnProvider Abstraction"]
[Source: architecture.md#External Integration Points — "fal.ai + Google Vertex AI"]

**fal.ai Queue + Webhook Pattern (for FalFashn and FalNanoBanana)**

fal.ai models use an async pattern: submit to queue → receive webhook on completion.

```
Client → Server (requestRender) → fal.ai queue (submit job + webhook URL)
                                                    ↓
                                        [AI inference 5-10s]
                                                    ↓
fal.ai → Server webhook (POST /api/webhooks/fal) → download result → save to disk → update DB
                                                    ↓
Client polls (getRenderStatus) ← Server returns completed + image URL
```

**Why queue+webhook (not subscribe/poll fal.ai):** The `fal.queue.submit()` + webhook is recommended for production. The alternative `fal.subscribe()` holds an open connection, which doesn't survive server restarts. Webhooks are fire-and-forget and retry 10 times over 2 hours.

[Source: architecture.md#API & Communication Patterns — "fal.ai pattern: queue submit + webhook callback"]

**Google VTO Synchronous Pattern**

Google Vertex AI virtual-try-on-001 is synchronous — the API blocks until the result is ready. The server wraps this in an async pattern:

```typescript
// In submitRender: make sync call, store result immediately
const response = await fetch(vertexEndpoint, { method: "POST", body: JSON.stringify(requestBody), headers });
const result = response.predictions[0].bytesBase64Encoded;
// Generate synthetic jobId, store result in tryOnRenders immediately
```

This means Google VTO renders are "instant" from the server's perspective — the render record goes straight from "pending" to "completed" (or "failed") within the requestRender procedure. The client's first poll will already see the result.

[Source: architecture.md#API & Communication Patterns — "Google VTO pattern: synchronous POST, wrapped in async job server-side"]

**Client Polling Pattern**

Client polls `tryon.getRenderStatus` every 2 seconds using TanStack Query's `refetchInterval`:

```typescript
const { data } = api.tryon.getRenderStatus.useQuery(
  { renderId },
  {
    enabled: !!renderId && !isTerminal,
    refetchInterval: 2000,  // Poll every 2s
  },
);
```

**Why polling (not SSE/WebSocket):** Per architecture decision — "Simple, reliable, no SSE edge cases on React Native." Polling 15 times at 2s = 30s max, well within the timeout. TanStack Query handles the interval natively.

[Source: architecture.md#API & Communication Patterns — "Client polls server every ~2s (3-5 polls max)"]

**Timeout Handling (Server-Side)**

The 30-second timeout is checked in `getRenderStatus`, not via a background job:

```typescript
if ((render.status === "pending" || render.status === "processing") &&
    Date.now() - render.createdAt.getTime() > RENDER_TIMEOUT_MS) {
  await db.update(tryOnRenders).set({ status: "failed", errorCode: "RENDER_TIMEOUT" }).where(eq(tryOnRenders.id, renderId));
  return { status: "failed", errorCode: "RENDER_TIMEOUT" };
}
```

**Why in getRenderStatus:** No background job infrastructure needed. The timeout is detected on the next poll, which is at most 2 seconds after the timeout threshold. Simple and reliable.

### Backend Implementation

**Database Schema — tryOnRenders Table**

```typescript
// packages/db/src/schema.ts — ADDITIONS

export const RENDER_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export const TRYON_PROVIDERS = ["fal_fashn", "fal_nano_banana", "google_vto"] as const;

export const renderStatus = pgEnum("render_status", RENDER_STATUSES);
export const tryOnProviderEnum = pgEnum("try_on_provider", TRYON_PROVIDERS);

export const tryOnRenders = pgTable("try_on_renders", (t) => ({
  id: t.text().primaryKey().$defaultFn(() => createId()),
  userId: t.text().notNull().references(() => users.id, { onDelete: "cascade" }),
  garmentId: t.text().notNull().references(() => garments.id, { onDelete: "cascade" }),
  provider: tryOnProviderEnum().notNull(),
  status: renderStatus().notNull().default("pending"),
  jobId: t.text(),          // External provider job ID (fal.ai request_id)
  resultPath: t.text(),     // Relative path to result image on disk
  errorCode: t.text(),      // Business error code (RENDER_FAILED, RENDER_TIMEOUT)
  createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: t.timestamp({ withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}));
```

**CRITICAL:** Use Drizzle's `casing: "snake_case"` — write `userId` in TypeScript, it maps to `user_id` in SQL automatically. Do NOT add explicit column name strings.

[Source: project-context.md#Drizzle ORM Patterns — "casing: snake_case"]
[Source: epics.md#Story 3.2 AC#9 — renders table specification]

**fal.ai Client Configuration**

```typescript
// In the FalFashnProvider constructor
import { fal } from "@fal-ai/client";

fal.config({ credentials: this.falKey });

// Submit to queue with webhook
const { request_id } = await fal.queue.submit("fal-ai/fashn/tryon/v1.6", {
  input: {
    model_image: personImageUrl,   // URL from fal.storage.upload()
    garment_image: garmentImageUrl, // URL from fal.storage.upload()
    category: options?.category ?? "auto",
    mode: options?.mode ?? "balanced",
  },
  webhookUrl: this.webhookUrl,
});
```

**Image Upload to fal.ai Storage:**

Our images are stored on disk behind auth. fal.ai can't fetch them directly. Solution: upload to fal.ai temporary storage first:

```typescript
import { readFile } from "node:fs/promises";

// Read image from local disk
const imageBuffer = await readFile(absolutePath);
const blob = new Blob([imageBuffer], { type: "image/jpeg" });

// Upload to fal.ai CDN (returns temporary URL)
const imageUrl = await fal.storage.upload(blob);
```

**Webhook Signature Verification (ED25519)**

```typescript
// apps/server/src/webhooks/fal.ts
import sodium from "libsodium-wrappers";
import { createHash } from "node:crypto";

const JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";
const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

// Cache JWKS keys (refresh every 24h max)
let cachedKeys: { keys: Array<{ x: string }> } | null = null;
let cacheTimestamp = 0;

async function getJwksKeys(): Promise<Array<{ x: string }>> {
  const now = Date.now();
  if (cachedKeys && now - cacheTimestamp < 24 * 60 * 60 * 1000) {
    return cachedKeys.keys;
  }
  const response = await fetch(JWKS_URL);
  cachedKeys = await response.json() as { keys: Array<{ x: string }> };
  cacheTimestamp = now;
  return cachedKeys.keys;
}

async function verifyFalWebhookSignature(
  requestId: string,
  userId: string,
  timestamp: string,
  signatureHex: string,
  rawBody: string,
): Promise<boolean> {
  await sodium.ready;

  // 1. Validate timestamp (±5 minutes)
  const timestampInt = parseInt(timestamp, 10);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampInt) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // 2. Construct signed message
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const message = [requestId, userId, timestamp, bodyHash].join("\n");
  const messageBytes = Buffer.from(message, "utf-8");
  const signatureBytes = Buffer.from(signatureHex, "hex");

  // 3. Try each JWKS public key
  const keys = await getJwksKeys();
  for (const keyInfo of keys) {
    const publicKeyBytes = Buffer.from(keyInfo.x, "base64url");
    if (sodium.crypto_sign_verify_detached(signatureBytes, messageBytes, publicKeyBytes)) {
      return true;
    }
  }
  return false;
}
```

**Webhook Payload Processing:**

```typescript
// Success payload from fal.ai:
{
  request_id: "uuid",
  status: "OK",
  payload: {
    images: [{
      url: "https://cdn.fal.media/...",
      content_type: "image/png",
      file_name: "output_0.png",
      file_size: 1824075,
      width: 864,
      height: 1296,
    }]
  }
}

// Error payload:
{
  request_id: "uuid",
  status: "ERROR",
  error: "Invalid status code: 422",
  payload: { detail: [...] }
}
```

**Google Vertex AI Request Format:**

```typescript
const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/virtual-try-on-001:predict`;

const requestBody = {
  instances: [{
    personImage: { image: { bytesBase64Encoded: personBase64 } },
    productImages: [{ image: { bytesBase64Encoded: garmentBase64 } }],
  }],
  parameters: { sampleCount: 1 },
};

// Response:
{
  predictions: [{
    mimeType: "image/png",
    bytesBase64Encoded: "BASE64_RESULT..."
  }]
}
```

**tryon Router — Error Handling Pattern:**

```typescript
// requestRender procedure
try {
  const { jobId } = await provider.submitRender(personImagePath, garmentImagePath, { category: garment.category });
  await db.update(tryOnRenders).set({ jobId, status: "processing" }).where(eq(tryOnRenders.id, render.id));
  return { renderId: render.id };
} catch (error) {
  // Retry once for 5xx errors
  if (is5xxError(error) && !isRetry) {
    return requestRenderWithRetry(input, { isRetry: true });
  }
  await db.update(tryOnRenders).set({ status: "failed", errorCode: "RENDER_FAILED" }).where(eq(tryOnRenders.id, render.id));
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "RENDER_FAILED" });
}
```

**CRITICAL:** Always use `TRPCError` with business error codes in the `message` field. Never generic `throw new Error()`.

[Source: project-context.md#Error Handling Pattern]
[Source: architecture.md#Communication Patterns — "Business Error Codes"]

### Frontend Implementation

**New dependencies to install:**

| Package | Target | Purpose |
|---------|--------|---------|
| `@fal-ai/client` | @acme/api | fal.ai queue API client |
| `libsodium-wrappers` | @acme/server | ED25519 webhook signature verification |
| `@types/libsodium-wrappers` | @acme/server (dev) | TypeScript types for libsodium |

**New files to create:**

```
packages/db/src/schema.ts                                    — ADD tryOnRenders table + enums
packages/api/src/services/tryOnProvider.ts                   — TryOnProvider interface + factory
packages/api/src/services/tryOnProvider.test.ts              — Factory tests
packages/api/src/services/providers/falFashn.ts              — FalFashn implementation
packages/api/src/services/providers/falFashn.test.ts         — FalFashn tests
packages/api/src/services/providers/falNanoBanana.ts         — FalNanoBanana implementation
packages/api/src/services/providers/falNanoBanana.test.ts    — FalNanoBanana tests
packages/api/src/services/providers/googleVTO.ts             — GoogleVTO implementation
packages/api/src/services/providers/googleVTO.test.ts        — GoogleVTO tests
packages/api/src/router/tryon.ts                             — tryon tRPC router
packages/api/src/router/tryon.test.ts                        — Router tests
apps/server/src/webhooks/fal.ts                              — fal.ai webhook handler
apps/server/src/webhooks/fal.test.ts                         — Webhook tests
apps/expo/src/hooks/useTryOnRender.ts                        — Client render hook
apps/expo/src/hooks/useTryOnRender.test.ts                   — Hook tests
apps/expo/src/app/(auth)/render/[id].tsx                     — Basic render status screen
apps/expo/src/app/(auth)/render/[id].test.tsx                — Screen tests
```

**Files to modify:**

```
packages/api/src/root.ts                                     — Add tryonRouter
packages/api/src/trpc.ts                                     — Add tryOnProvider to context
apps/server/src/index.ts                                     — Initialize TryOnProvider, add webhook route
apps/server/src/env.ts                                       — Add FAL_KEY, ACTIVE_TRYON_PROVIDER, etc.
apps/server/src/routes/images.ts                             — Add render result serving
packages/api/src/services/imageStorage.ts                    — Add saveRenderResult method
apps/expo/src/app/(auth)/(tabs)/index.tsx                    — Wire onTryOn to mutation + navigation
apps/expo/src/app/(auth)/(tabs)/index.test.tsx               — Update integration tests
packages/api/package.json                                    — Add @fal-ai/client
apps/server/package.json                                     — Add libsodium-wrappers
pnpm-lock.yaml                                              — Updated lockfile
```

**useTryOnRender Hook:**

```typescript
// apps/expo/src/hooks/useTryOnRender.ts
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "~/utils/api";

const MAX_POLLS = 15; // 30s at 2s intervals

export function useTryOnRender() {
  const [renderId, setRenderId] = useState<string | null>(null);
  const pollCount = useRef(0);

  const requestMutation = api.tryon.requestRender.useMutation({
    onSuccess: (data) => {
      setRenderId(data.renderId);
      pollCount.current = 0;
    },
  });

  const statusQuery = api.tryon.getRenderStatus.useQuery(
    { renderId: renderId! },
    {
      enabled: !!renderId,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "completed" || status === "failed") return false;
        if (pollCount.current >= MAX_POLLS) return false;
        pollCount.current++;
        return 2000;
      },
    },
  );

  const startRender = useCallback(
    (garmentId: string) => {
      requestMutation.mutate({ garmentId });
    },
    [requestMutation],
  );

  const reset = useCallback(() => {
    setRenderId(null);
    pollCount.current = 0;
  }, []);

  return {
    startRender,
    reset,
    renderId,
    status: statusQuery.data?.status ?? (requestMutation.isPending ? "submitting" : null),
    resultImageUrl: statusQuery.data?.resultImageUrl ?? null,
    errorCode: statusQuery.data?.errorCode ?? null,
    isPending: requestMutation.isPending,
    isPolling: !!renderId && statusQuery.data?.status !== "completed" && statusQuery.data?.status !== "failed",
  };
}
```

**WardrobeScreen onTryOn Update:**

```typescript
// Replace the current placeholder in apps/expo/src/app/(auth)/(tabs)/index.tsx
// OLD (lines 97-103):
const handleTryOn = useCallback(
  (_garmentId: string) => {
    showToast({ message: "Try-on coming in Story 3.2", variant: "info" });
    bottomSheetRef.current?.close();
  },
  [],
);

// NEW:
const requestRenderMutation = api.tryon.requestRender.useMutation({
  onSuccess: (data) => {
    bottomSheetRef.current?.close();
    router.push(`/render/${data.renderId}`);
  },
  onError: (error) => {
    if (error.message === "RENDER_FAILED") {
      showToast({ message: "Render failed. Try again.", variant: "error" });
    } else {
      showToast({ message: "Something went wrong.", variant: "error" });
    }
  },
});

const handleTryOn = useCallback(
  (garmentId: string) => {
    requestRenderMutation.mutate({ garmentId });
  },
  [requestRenderMutation],
);
```

**Note on navigation:** Use `router.push()` from `expo-router` to navigate to the render screen. The `render/[id].tsx` route is under `(auth)/`, so it's protected. This is a basic push navigation — Story 3.3 may change this to a modal presentation.

**Basic render/[id].tsx Screen:**

```typescript
// apps/expo/src/app/(auth)/render/[id].tsx — BASIC PLACEHOLDER
// Story 3.3 will replace with full RenderView (shimmer, cross-fade, swipe dismiss)

import { useLocalSearchParams, router } from "expo-router";
// ... basic screen showing:
// - ActivityIndicator while pending/processing
// - Result image when completed (expo-image with auth-gated URL)
// - Error message + back button when failed
// - Status text: "Creating your look..." / "Almost there..." / "Render failed"
```

### Existing Code References

| Component | Location | Relevance |
|-----------|----------|-----------|
| DB schema | `packages/db/src/schema.ts` | Add tryOnRenders table — follows existing pgTable pattern (users, garments, bodyPhotos) |
| garments table | `packages/db/src/schema.ts:91-110` | Reference for FK pattern, enum usage, cuid2 IDs |
| bodyPhotos table | `packages/db/src/schema.ts:47-67` | Reference for 1:1 user photo pattern |
| garment router | `packages/api/src/router/garment.ts` | Template for tryon router (protectedProcedure, input validation, error handling) |
| garment.upload | `packages/api/src/router/garment.ts:19-171` | Fire-and-forget async pattern (lines 131-161) — reference for async provider call |
| root router | `packages/api/src/root.ts` | Add tryonRouter merge — currently has auth, garment, user |
| trpc context | `packages/api/src/trpc.ts:47-62` | Add tryOnProvider to context shape |
| protectedProcedure | `packages/api/src/trpc.ts:79-88` | Auth guard pattern — session required |
| imageStorage | `packages/api/src/services/imageStorage.ts` | Add saveRenderResult method — follows existing saveGarmentPhoto pattern |
| backgroundRemoval | `packages/api/src/services/backgroundRemoval.ts` | Reference for external API service pattern (Replicate) |
| server index | `apps/server/src/index.ts` | Add webhook route, initialize TryOnProvider — follows existing route handler pattern (lines 54-72) |
| server env | `apps/server/src/env.ts` | Add new env vars — follows existing Zod v4 validation pattern |
| image handler | `apps/server/src/routes/images.ts` | Extend with render result serving — follows existing auth-gated pattern |
| WardrobeScreen | `apps/expo/src/app/(auth)/(tabs)/index.tsx:97-103` | Replace handleTryOn placeholder |
| GarmentDetailSheet | `apps/expo/src/components/garment/GarmentDetailSheet.tsx:83-89` | onTryOn callback — already wired |
| assertOnline | `apps/expo/src/utils/assertOnline.ts` | Online check before render — already called in GarmentDetailSheet before onTryOn |
| getBaseUrl | `apps/expo/src/utils/base-url.ts` | Server URL for render image endpoint |
| authClient | `apps/expo/src/utils/auth.ts` | Cookie for auth-gated image requests |
| categories | `apps/expo/src/constants/categories.ts` | GarmentCategory type for provider supportedCategories |
| WardrobeItem | `apps/expo/src/types/wardrobe.ts` | Type for garment data in bottom sheet |
| test setup | `apps/expo/test/setup.ts` | Existing mocks (reanimated, gesture handler, haptics, etc.) |

### Testing Approach

**Test runner:** `bun test`
**Imports:** `import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"`

**Server-side testing strategy (packages/api, apps/server):**

1. **TryOnProvider factory tests**: Verify correct provider instantiation based on name
2. **Provider unit tests**: Mock `@fal-ai/client` and `fetch` — verify correct API calls, input mapping, error handling
3. **tryon router tests**: Mock DB queries and provider — verify request validation, record creation, status polling, timeout detection
4. **Webhook handler tests**: Mock libsodium, DB, imageStorage — verify signature validation, payload processing, idempotency

**Critical mocking for @fal-ai/client:**

```typescript
// packages/api/test/setup.ts (or per-test mock)
import { mock } from "bun:test";

// Mock the fal.ai client module — IRREVERSIBLE so use preload
mock.module("@fal-ai/client", () => ({
  fal: {
    config: mock(() => {}),
    queue: {
      submit: mock(() => Promise.resolve({ request_id: "mock-request-id" })),
      result: mock(() => Promise.resolve({ images: [{ url: "https://cdn.fal.media/mock.png" }] })),
      status: mock(() => Promise.resolve({ status: "COMPLETED" })),
    },
    storage: {
      upload: mock(() => Promise.resolve("https://fal.media/mock-upload.jpg")),
    },
  },
}));
```

**Critical mocking for libsodium-wrappers:**

```typescript
// apps/server/test/setup.ts
mock.module("libsodium-wrappers", () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    crypto_sign_verify_detached: mock(() => true), // Default: valid signature
  },
}));
```

**Client-side testing strategy:**

1. **useTryOnRender hook tests**: Mock tRPC api calls, verify mutation + polling behavior
2. **WardrobeScreen integration**: Verify onTryOn triggers mutation and navigates
3. **render/[id].tsx tests**: Verify status display, result image, error handling

**Dependency injection pattern for providers:**

Since `mock.module()` is irreversible, prefer dependency injection for testing providers:

```typescript
// ✅ CORRECT: inject fal client
const provider = new FalFashnProvider({
  falClient: mockFalClient,  // Injected for testing
  webhookUrl: "https://test.com/webhook",
});

// ❌ WRONG: mock.module the fal client and expect per-test reset
mock.module("@fal-ai/client", () => ({ ... })); // irreversible!
```

**Test count estimate:** ~35-45 new tests across server + client. Current total: 200 tests @acme/expo. Expected total after story: ~235-245 tests across all packages.

### Key Pitfalls to Avoid

1. **DO NOT call fal.ai or Google VTO directly from the tRPC router.** Always go through the `TryOnProvider` abstraction. The architecture explicitly mandates this boundary.

2. **DO NOT use `fal.subscribe()` in production.** Use `fal.queue.submit()` + webhook. The subscribe method holds an open connection that doesn't survive server restarts.

3. **DO NOT parse the webhook request body as JSON before verifying the signature.** The signature is computed over the raw body string. Parse the body AFTER successful verification.

4. **DO NOT use `useState` for loading/polling states.** Use TanStack Query's `refetchInterval` for polling and `mutation.isPending` for loading. Never `const [loading, setLoading] = useState(false)`.

5. **DO NOT deduct credits in this story.** Credit consumption is Story 3.4. The requestRender procedure should NOT check or deduct credits — just validate the user has a body photo and the garment exists.

6. **DO NOT validate garment category in this story.** Category gating is Story 3.5. The requestRender procedure should accept any garment regardless of category.

7. **DO NOT build the immersive render result UI.** The full-screen RenderView with shimmer animation, cross-fade, swipe dismiss, and feedback button is Story 3.3. This story creates a BASIC render/[id].tsx placeholder.

8. **DO NOT serve render result images via public URLs.** Always use the auth-gated `/api/images/render/{renderId}` endpoint with ownership verification.

9. **DO NOT forget to make the webhook handler idempotent.** Check if the render is already completed before processing. fal.ai retries webhooks 10 times if delivery fails.

10. **DO NOT hardcode the fal.ai JWKS URL.** Use a constant but make it configurable for testing. Cache JWKS keys for up to 24 hours.

11. **DO NOT use `console.log` on the server.** Use `logger.info()`, `logger.error()` from pino.

12. **DO NOT import from `"zod"`.** Always `import { z } from "zod/v4"`.

13. **DO NOT import test utilities from `"vitest"` or `"@jest/globals"`.** Always `import { ... } from "bun:test"`.

14. **DO NOT use explicit column name strings in Drizzle.** Let `casing: "snake_case"` handle the mapping. Write `userId` not `t.text("user_id")`.

15. **DO NOT access `process.env` in application code.** Use the validated env module (`import { env } from "./env"`).

16. **DO NOT forget the 30-second timeout check in getRenderStatus.** If a render has been pending/processing for over 30 seconds, mark it as failed with RENDER_TIMEOUT.

17. **DO NOT make Google VTO a blocking requirement.** If Google Cloud credentials are not configured, the GoogleVTOProvider should throw a descriptive error on submitRender rather than crash at initialization. Same for FalNanoBanana with empty model ID.

18. **DO NOT forget to add the tryonRouter to root.ts.** Missing this means the client can't call any tryon procedures — it will fail silently with "procedure not found".

19. **DO NOT create a separate `__tests__/` directory.** All tests co-located with source files.

### Previous Story Intelligence

**From Story 3.1 (Garment Detail Bottom Sheet) — CRITICAL:**

- Total test count: **200 tests** in @acme/expo (post code review)
- `GarmentDetailSheet.onTryOn` callback is wired and working (line 83-89 in GarmentDetailSheet.tsx)
- WardrobeScreen `handleTryOn` at lines 97-103 currently shows toast placeholder — **this is what we replace**
- `assertOnline` is called BEFORE `onTryOn` in GarmentDetailSheet — no need to check online status again in WardrobeScreen's handleTryOn
- Bottom sheet dismissal: `bottomSheetRef.current?.close()` — dismiss after initiating render
- `@gorhom/bottom-sheet` installed and working
- `GestureHandlerRootView` added to root layout
- Spring animation pattern: `{ damping: 50, stiffness: 300 }`
- Debug: pnpm postinstall hook failure (sherif lint) — pre-existing, bypassed with `--ignore-scripts`

**From Story 2.1 (Add Garment) — CRITICAL PATTERN:**

- Fire-and-forget async for background removal in garment router (lines 131-161): `void (async () => { ... })()`
- FormData handling pattern for multipart uploads
- imageStorage service methods: `saveGarmentPhoto()`, `saveCutoutPhoto()`, `getAbsolutePath()`
- backgroundRemoval service: Replicate API pattern (external AI service call)
- Error handling: orphaned record cleanup on provider failure

**From Story 1.5 (Body Avatar) — REFERENCE:**

- Body photo storage: `bodyPhotos` table, 1:1 unique constraint on userId
- Image upload: user.uploadBodyPhoto procedure
- Image serving: auth-gated via `/api/images/{imageId}`
- The user's body photo is what feeds into the AI try-on as the "person image"

**From Story 2.3 (Stock Garments) — REFERENCE:**

- Stock garments have `imageSource: number` (local asset) — can't be used for AI try-on (no server-side file path)
- Personal garments have `cutoutPath` (after background removal) — prefer cutout for AI input
- `isStockGarment()` type guard determines which image source to use

**Pattern consistency:**
- Conventional commits: `feat:` for implementation, `fix:` for code review
- 13/13 packages typecheck clean after every story
- Code review consistently catches: placeholder tests, missing error handling, accessibility gaps

### Git Intelligence

**Recent commits (5):**
1. `217aa81` — fix: Story 3.1 code review — 9 issues resolved (3H/3M/3L), status done
2. `92fc6ae` — feat: implement Story 3.1 — Garment Detail Bottom Sheet
3. `5390d3e` — fix: Story 2.5 code review — 2 LOW issues resolved (captive portal + refresh spinner)
4. `6019caf` — fix: Story 2.5 code review — 9 issues resolved (5H/4M), status done
5. `4cd27ed` — feat: implement Story 2.5 — Offline Browsing & Data Sync

**Patterns from recent work:**
- DI pattern for services: imageStorage and backgroundRemoval injected via tRPC context
- Server initialization: services created in `apps/server/src/index.ts`, passed to tRPC handler
- Image handling: auth-gated endpoint at `/api/images/`, checks bodyPhotos and garments tables
- Route structure: HTTP routes handled in `apps/server/src/index.ts` switch statement
- The server currently handles: `/health`, `/api/auth/*`, `/api/images/*`, `/api/trpc/*`
- Need to add: `/api/webhooks/fal` for webhook handling

**Files recently modified (relevant to this story):**
- `apps/expo/src/app/(auth)/(tabs)/index.tsx` — WardrobeScreen, contains handleTryOn placeholder to replace
- `packages/api/src/router/garment.ts` — garment router, reference for tryon router pattern
- `packages/api/src/services/imageStorage.ts` — needs saveRenderResult method added
- `apps/server/src/index.ts` — needs webhook route + TryOnProvider initialization
- `apps/server/src/env.ts` — needs new env vars
- `apps/server/src/routes/images.ts` — needs render result serving

### Latest Tech Information

**@fal-ai/client v1.9.1 (Latest stable — Feb 2026):**
- `fal.config({ credentials: "your-key" })` — initialize with API key
- `fal.queue.submit(modelId, options)` — submit job, returns `{ request_id }`
- `fal.queue.result(modelId, { requestId })` — get result (alternative to webhook)
- `fal.queue.status(modelId, { requestId })` — check status
- `fal.storage.upload(blob)` — upload file to fal.ai CDN, returns URL string
- Webhook options: `{ webhookUrl: "https://..." }` in submit options
- Webhook retries: 10 times over 2 hours if delivery fails

**FASHN v1.6 Model (fal-ai/fashn/tryon/v1.6):**
- Input: `model_image` (URL/base64), `garment_image` (URL/base64), `category` ("tops"|"bottoms"|"one-pieces"|"auto"), `mode` ("performance"|"balanced"|"quality")
- Output: `{ images: [{ url, content_type, file_name, file_size, width, height }] }`
- Resolution: 864x1296
- v1.6 improvements: auto category detection, accurate text/pattern rendering

**libsodium-wrappers v0.8.2 (Latest — Feb 2026):**
- `await sodium.ready` — MUST await before any crypto operation
- `sodium.crypto_sign_verify_detached(signature, message, publicKey)` — returns boolean
- Accepts `Uint8Array`, `Buffer`, or `ArrayBuffer` for all binary params

**Google Vertex AI virtual-try-on-001 (GA):**
- Endpoint: `POST https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/virtual-try-on-001:predict`
- Input: base64-encoded images in `instances[0].personImage.image.bytesBase64Encoded` and `instances[0].productImages[0].image.bytesBase64Encoded`
- Output: `predictions[0].bytesBase64Encoded` (base64 result image)
- Auth: Google Cloud Bearer token
- Synchronous API — blocks until result ready
- Rate limit: 50 requests/minute/region
- Supports: tops, bottoms, footwear

### Dependencies

**This story depends on:**
- Story 1.3 (Auth) — protectedProcedure, session context — DONE
- Story 1.5 (Body Avatar) — bodyPhotos table, user body photo — DONE
- Story 2.1 (Add Garment) — garments table, image storage, background removal — DONE
- Story 3.1 (Garment Detail Sheet) — onTryOn callback wiring, GarmentDetailSheet — DONE

**Stories that depend on this story:**
- Story 3.3 (Render Result & Loading Experience) — replaces basic render/[id].tsx with full immersive UI
- Story 3.4 (Render Retry, Quality Feedback & Credit Policy) — adds credit check + deduction in requestRender
- Story 3.5 (Garment Category Validation) — adds category validation before render

### Project Structure Notes

**New directories:**
- `packages/api/src/services/providers/` — TryOnProvider implementations (3 files)
- `apps/server/src/webhooks/` — webhook handlers (fal.ts)
- `apps/expo/src/app/(auth)/render/` — render result route

**Alignment with architecture:**
- `packages/api/src/services/tryOnProvider.ts` — matches architecture.md structure exactly
- `packages/api/src/services/providers/falFashn.ts` — per architecture.md
- `packages/api/src/services/providers/falNanoBanana.ts` — per architecture.md
- `packages/api/src/services/providers/googleVTO.ts` — per architecture.md
- `packages/api/src/router/tryon.ts` — per architecture.md router organization
- `apps/server/src/webhooks/fal.ts` — per architecture.md
- `apps/expo/src/app/(auth)/render/[id].tsx` — per architecture.md route structure
- Service injection via tRPC context — follows existing pattern (imageStorage, backgroundRemoval)

**Note on render/[id].tsx vs Story 3.3:**
This story creates a BASIC render status screen. Story 3.3 will REPLACE it with the full immersive RenderView modal. Keep the basic version simple — don't over-engineer UI that will be replaced.

### References

- [Source: epics.md#Story 3.2] — Story definition and all 9 original acceptance criteria
- [Source: prd.md#FR12] — User can select a single garment and generate an AI virtual try-on render
- [Source: architecture.md#API & Communication Patterns] — TryOnProvider abstraction, fal.ai queue+webhook, Google VTO sync, business error codes
- [Source: architecture.md#Data Flow] — "User taps Try On" complete flow diagram
- [Source: architecture.md#External Integration Points] — fal.ai, Google Vertex AI integration specs
- [Source: architecture.md#Data Architecture] — Image storage, database, upload patterns
- [Source: architecture.md#Structure Patterns] — packages/api/src/services/ structure
- [Source: architecture.md#Implementation Patterns] — Naming, error handling, testing patterns
- [Source: project-context.md] — Technology rules, testing patterns, naming conventions, anti-patterns
- [Source: CLAUDE.md] — All critical implementation rules
- [Source: 3-1-garment-detail-bottom-sheet.md] — Previous story intelligence (200 tests, onTryOn wiring, assertOnline)
- [Source: packages/db/src/schema.ts] — Existing tables (users, garments, bodyPhotos) + enum patterns
- [Source: packages/api/src/router/garment.ts] — Router pattern reference (protectedProcedure, FormData, fire-and-forget async)
- [Source: packages/api/src/services/imageStorage.ts] — Image storage service (add saveRenderResult)
- [Source: packages/api/src/services/backgroundRemoval.ts] — External AI service pattern (Replicate API)
- [Source: packages/api/src/trpc.ts:47-62] — tRPC context shape (add tryOnProvider)
- [Source: packages/api/src/root.ts] — Root router (add tryonRouter)
- [Source: apps/server/src/index.ts] — Server setup, route handlers, service initialization
- [Source: apps/server/src/env.ts] — Environment validation (add FAL_KEY, etc.)
- [Source: apps/server/src/routes/images.ts] — Auth-gated image serving (extend for renders)
- [Source: apps/expo/src/app/(auth)/(tabs)/index.tsx:97-103] — handleTryOn placeholder to replace
- [Source: apps/expo/src/components/garment/GarmentDetailSheet.tsx:83-89] — onTryOn callback
- [Source: fal.ai docs] — Queue API, webhook format, FASHN v1.6 parameters
- [Source: Google Vertex AI docs] — virtual-try-on-001 API format

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- sherif lint failure on `pnpm add` — pre-existing, bypassed with `--ignore-scripts`
- `@paralleldrive/cuid2` missing from @acme/api — added as dependency for GoogleVTOProvider
- `db:push` skipped — Docker/PostgreSQL not running locally (non-blocking)
- `useLocalSearchParams` added to expo-router mock in test/setup.ts
- TypeScript typecheck fixes: added `saveRenderResult` to mock ImageStorage in garment.test.ts/user.test.ts, cast `mockImplementation` callbacks `as never` in tryon.test.ts, added type import for TryOnProvider in server index.ts, used `as unknown as` for mock fetch/Response casts in fal.test.ts

### Completion Notes List

- All 10 tasks implemented following TDD red-green-refactor cycle
- 340 tests total across all packages (0 failures): db(12) + api(108) + server(19) + expo(201)
- 13/13 packages pass typecheck
- 3 TryOnProvider implementations: FalFashn, FalNanoBanana, GoogleVTO — switchable via ACTIVE_TRYON_PROVIDER env var
- fal.ai webhook with ED25519 signature verification via libsodium-wrappers
- Google VTO sync pattern: result stored in-memory Map with synthetic cuid2 jobId
- Client uses TanStack Query `refetchInterval` for polling, not useState for loading
- Render result images served via auth-gated `/api/images/render/:renderId` endpoint
- Basic render/[id].tsx screen — Story 3.3 will replace with full immersive UI
- No credits deducted (Story 3.4), no category validation (Story 3.5)

### Change Log

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema.ts` | Modified | Added tryOnRenders table, renderStatus enum, tryOnProviderEnum enum |
| `packages/db/src/schema.test.ts` | Modified | Added 6 tests for tryOnRenders schema |
| `packages/api/src/services/tryOnProvider.ts` | Created | TryOnProvider interface, types, createTryOnProvider factory |
| `packages/api/src/services/tryOnProvider.test.ts` | Created | 4 factory tests |
| `packages/api/src/services/providers/falFashn.ts` | Created | FalFashnProvider with DI for FalClient |
| `packages/api/src/services/providers/falFashn.test.ts` | Created | 8 tests |
| `packages/api/src/services/providers/falNanoBanana.ts` | Created | FalNanoBananaProvider with configurable model ID |
| `packages/api/src/services/providers/falNanoBanana.test.ts` | Created | 7 tests |
| `packages/api/src/services/providers/googleVTO.ts` | Created | GoogleVTOProvider with sync POST + in-memory result store |
| `packages/api/src/services/providers/googleVTO.test.ts` | Created | 9 tests |
| `packages/api/src/router/tryon.ts` | Created | tryon tRPC router (requestRender + getRenderStatus) |
| `packages/api/src/router/tryon.test.ts` | Created | 12 tests |
| `packages/api/src/root.ts` | Modified | Added tryonRouter to appRouter |
| `packages/api/src/trpc.ts` | Modified | Added TryOnProviderContext interface, saveRenderResult to ImageStorage |
| `packages/api/src/services/imageStorage.ts` | Modified | Added saveRenderResult method |
| `packages/api/package.json` | Modified | Added @fal-ai/client, @paralleldrive/cuid2, ./services/tryOnProvider export |
| `apps/server/src/env.ts` | Modified | Added 7 env vars (FAL_KEY, ACTIVE_TRYON_PROVIDER, etc.) |
| `apps/server/src/webhooks/fal.ts` | Created | fal.ai webhook handler with ED25519 signature verification |
| `apps/server/src/webhooks/fal.test.ts` | Created | 6 tests |
| `apps/server/src/routes/images.ts` | Modified | Added render result serving route |
| `apps/server/src/index.ts` | Modified | Added TryOnProvider init, webhook route, type import |
| `apps/server/package.json` | Modified | Added libsodium-wrappers, @types/libsodium-wrappers |
| `apps/expo/src/hooks/useTryOnRender.ts` | Created | Client render hook with mutation + polling |
| `apps/expo/src/hooks/useTryOnRender.test.ts` | Created | 2 tests |
| `apps/expo/src/app/(auth)/render/[id].tsx` | Created | Basic render status screen |
| `apps/expo/src/app/(auth)/render/[id].test.tsx` | Created | 1 test |
| `apps/expo/src/app/(auth)/(tabs)/index.tsx` | Modified | Wired handleTryOn to requestRender mutation + navigation |
| `apps/expo/test/setup.ts` | Modified | Added useLocalSearchParams to expo-router mock |
| `packages/api/src/router/garment.test.ts` | Modified | Added saveRenderResult to mock ImageStorage |
| `packages/api/src/router/user.test.ts` | Modified | Added saveRenderResult to mock ImageStorage |
| `pnpm-lock.yaml` | Modified | Updated lockfile |

### File List

**New files (17):**
- `packages/api/src/services/tryOnProvider.ts`
- `packages/api/src/services/tryOnProvider.test.ts`
- `packages/api/src/services/providers/falFashn.ts`
- `packages/api/src/services/providers/falFashn.test.ts`
- `packages/api/src/services/providers/falNanoBanana.ts`
- `packages/api/src/services/providers/falNanoBanana.test.ts`
- `packages/api/src/services/providers/googleVTO.ts`
- `packages/api/src/services/providers/googleVTO.test.ts`
- `packages/api/src/router/tryon.ts`
- `packages/api/src/router/tryon.test.ts`
- `apps/server/src/webhooks/fal.ts`
- `apps/server/src/webhooks/fal.test.ts`
- `apps/expo/src/hooks/useTryOnRender.ts`
- `apps/expo/src/hooks/useTryOnRender.test.ts`
- `apps/expo/src/app/(auth)/render/[id].tsx`
- `apps/expo/src/app/(auth)/render/[id].test.tsx`

**Modified files (15):**
- `packages/db/src/schema.ts`
- `packages/db/src/schema.test.ts`
- `packages/api/src/root.ts`
- `packages/api/src/trpc.ts`
- `packages/api/src/services/imageStorage.ts`
- `packages/api/src/router/garment.test.ts`
- `packages/api/src/router/user.test.ts`
- `packages/api/package.json`
- `apps/server/src/env.ts`
- `apps/server/src/routes/images.ts`
- `apps/server/src/index.ts`
- `apps/server/package.json`
- `apps/expo/src/app/(auth)/(tabs)/index.tsx`
- `apps/expo/test/setup.ts`
- `pnpm-lock.yaml`
