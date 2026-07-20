# WearBloom — Product Requirements Document

**Status:** Product and technical specification  
**Date:** July 20, 2026  
**Objective:** Provide a complete, self-contained definition of the product, experience, and architecture required to build WearBloom.

This document is the project's source of truth. No other document or context is required to interpret the decisions it contains.

## 1. Vision and positioning

WearBloom is a **dedicated iOS app**, designed first for iPhone and built with **SwiftUI**. It helps a user decide what to wear by composing a look from clothes she already owns, then generating an image of herself wearing that look.

The initial launch is international and English-language, with the United States as the first market. The initial audience is women; the exact age range remains to be determined through user research and early acquisition tests.

The product has a **premium, editorial, fashion-led** identity. It should give users a sense of control and confidence without promising an exact simulation of fit, drape, or body shape.

### Promise

> Compose a look from your own closet, then see it on you.

The user should be able to tell herself: **“I know these clothes look good on me.”** The result is visual inspiration and a decision aid, not a guarantee of fit or sizing.

### Commercial hypothesis

After receiving a credible first personal render, a user will want to try more looks and will pay for a subscription that includes a defined number of generations per month.

“iOS app” does not mean “no backend.” A minimal backend is still required to:

- protect the AI provider key;
- start and track asynchronous renders;
- enforce quotas and prevent abuse;
- store or relay images privately;
- delete user data;
- verify paid access when it is not fully delegated to a third-party service.

The target is therefore not a general-purpose full-stack product, but:

1. a SwiftUI app;
2. a narrow API limited to operations that are impossible or unsafe on the device;
3. a replaceable virtual try-on provider;
4. the minimum server-side persistence required by the validated product.

## 2. Product principles and success criteria

- WearBloom composes a complete look, not just an isolated single-garment try-on.
- Only one garment is active per category; a dress replaces top + bottom, and outerwear remains optional.
- The first personal result should require only one photo of the user and the selected garments, without requiring a full closet import.
- Stock photos may explain the product but cannot replace the first result generated from the user's own photo.
- Closet management, manual composition, and saved looks retain lasting free value; image generation is the premium feature.
- A technical failure never consumes a generation.
- Daily frequency and willingness to pay are hypotheses to measure, not assumptions to treat as facts.

The product primarily tracks:

- percentage of users who complete a first personal render;
- percentage of results rated useful or credible;
- voluntary request for a second render;
- unprompted Day 7 return;
- average cost per useful render;
- stated willingness to pay, followed by actual conversion on a meaningful sample.

## 3. Out of scope at launch

- exhaustive or mandatory import of the user's entire closet during onboarding;
- complex category and carousel navigation;
- a complete offline mode and general-purpose sync queue;
- stock body photos as a substitute for the first personal result;
- a required account before the user sees value;
- a sophisticated credit system, monthly reimbursements, or weekly subscription;
- multiple active AI providers at launch;
- Android;
- an admin dashboard;
- affiliate features, streaks, coaching, weather, and re-engagement notifications; only transactional render-complete notifications are included.

These items may be evaluated after observing real usage. They must not be implemented during the initial build.

## 4. Initial product

### Hypothesis under test

> After seeing a credible image of herself in a look composed from multiple garments she owns, a user will spontaneously want to try another look and will pay to repeat the experience.

### Primary journey

1. The user opens the app and sees a clear demonstration of the expected result.
2. She selects or takes a photo of herself using a non-blocking visual guide.
3. She adds images of the garments she wants to combine. The app supports free composition of multiple primary garments.
4. The app checks visible prerequisites locally before upload.
5. The app starts the render and sets honest expectations about the wait.
6. She receives the result and answers two questions:
   - “Does this look like you?”
   - “Does this help you decide?”
7. The app immediately offers to replace a garment, save the look, or create another try-on.
8. Account creation or purchase appears only when it provides clear value: keeping the result, syncing, or continuing after the free allowance.

### Initial functional scope

- free composition of multiple primary garments;
- import from Photos and Camera;
- a photo-taking guide;
- file format and size checks plus minimal image validation;
- automatic garment-category detection with quick user confirmation;
- generation of a personal render;
- persistent closet with deletion and a distinct record for every added garment;
- composition and saving of looks without a paid generation;
- garment-by-garment editing of a look;
- multiple reference photos, optionally including a previous render;
- sharing or saving a result with clear privacy messaging;
- feedback collection;
- immediate deletion of remote data from the app;
- funnel and performance instrumentation.

Shoes, bags, and accessories are not required in the initial scope.

### Launch navigation architecture

The initial release does not A/B test the main navigation. It adopts a clear hypothesis: composition is the core action, while the closet and saved looks are the resources that support it.

Tab bar:

1. **Closet** — saved garments, categories, and adding garments;
2. **Create** — center tab and default opening screen;
3. **Looks** — saved looks, renders, and comparisons.

Profile, subscription, privacy, and settings are available from a button at the top of the screen rather than a fourth launch tab.

The **Create** screen contains:

- the active reference photo;
- category slots for top, bottom, dress, and outerwear;
- one active garment per category;
- the rule that dress is incompatible with top + bottom;
- a free collage of the composed look;
- **Save Look** and **See It on Me** actions;
- the generation allowance only when it helps explain the offer.

### Composition and generation flow

Composition spans two screens:

1. **Create** — select and replace garments;
2. **Look Review** — editorial summary before generation.

The **Look Review** screen displays:

- the selected reference photo;
- the selected-garment collage;
- a compact list of garments and categories;
- an **Edit** action that returns to the composer without losing the selection;
- a **Save Look** action;
- the primary **See It on Me** button;
- the applicable generation balance or rule near the button.

Tapping **See It on Me** starts generation immediately. There is no second confirmation dialog unless the user reaches the paywall. The consumption rule is explained before the action: a technically failed generation is not deducted.

The look is automatically saved as a draft when the user enters Look Review so that going back, interrupting the app, or encountering a failed generation never loses the composition. The user does not have to name the look before receiving value.

### Looks, references, and variants

A **Look** stores:

- an automatically generated, editable name;
- the selected garment IDs;
- garment order and category within the composition;
- the active reference photo;
- creation and last-updated dates;
- an optional planned date, not exposed at launch;
- a status: `draft`, `saved`, or `archived`;
- its generated variants.

A look receives a discreet automatic name such as `Look 12`, `Evening Look` when an intent was selected, or a localized date. Renaming remains optional and happens after creation, never as a blocking step.

Every generation creates a distinct **Render Variant**. It never overwrites a previous render. A variant stores:

- the generated image;
- an exact snapshot of the garments and reference photo used;
- provider, model, and server-side prompt version;
- generation status and duration;
- quality feedback;
- consumption or reimbursement information;
- favorite status;
- shares created from that variant.

A look can be edited after generation. Previous renders remain attached to the snapshots that produced them, while the look always displays its current composition. This allows a user to replace one garment and compare variants without artificially creating multiple looks.

Variants are kept until the user explicitly deletes the look, variant, or account. A **Choose as Cover** action selects the main image displayed in Looks.

### Reference photos

The user can keep multiple reference photos. Each photo has:

- an automatic name (`My Photo`, then `My Photo 2`, and so on);
- an editable name;
- a thumbnail;
- its date added;
- a default-photo status.

Suggested names such as `Mirror`, `Full Body`, or `Evening` are not imposed. WearBloom avoids turning photo management into a form. A previous render may be reused as a reference, but it is clearly labeled as a generated image to prevent confusion.

Complex layering, shoes, accessories, and calendar features are excluded at launch. The data model retains an optional date so that “Wear this on…” can be added later without a structural change.

### Local background removal

The original garment photo remains the source sent to the generative model. A cutout version is used only to present the closet and collages in a premium way.

Proposed pipeline:

1. local segmentation with Apple Vision `GenerateForegroundInstanceMaskRequest`;
2. creation of a transparent thumbnail on the iPhone;
3. simple automatic visual validation with the option to use the original image;
4. no mandatory server call when adding a garment;
5. a remote background-removal service only if local success rates prove insufficient.

Background removal must never block garment creation. When it fails, WearBloom displays a cropped card based on the original image.

## 5. Onboarding and reveal

Onboarding is a central part of the commercial product. It should feel emotional and editorial, but every screen must either increase desire, reduce concern, or move the user toward her first result.

Reference journey to prototype:

1. visual promise and a real before-and-after;
2. quick intent selection: prepare for tomorrow, dress for an occasion, or experiment;
3. reassuring explanation of how photos are used;
4. reference-photo selection;
5. garment selection or addition;
6. quick validation of automatically detected categories;
7. generation accompanied by a staged editorial animation;
8. result reveal;
9. save, edit, or share;
10. transition into the long-term closet experience.

The wait must be staged honestly with states such as “Reading your pieces,” “Composing your look,” and “Final touches.” If the wait becomes long, the app must let the user leave the screen and notify her when the result is ready.

### Blurred-result paywall

Showing a blurred result before purchase is a conversion hypothesis to test, not a final decision. It creates three risks: generation cost paid before conversion, frustration after requesting personal photos, and the impression that the app is artificially withholding a result it has already created.

The reference test should compare:

- **Trust variant:** reveal the first result for free, then show the paywall before the next one;
- **Teaser variant:** partially reveal or blur the first result and unlock it through a free trial or subscription;
- **Hybrid variant:** show an animated or cropped preview, then provide the full reveal for free after a non-paid activation action, with the paywall before the second render.

The copy must never imply that the user already owns a result for free before blocking access to it.

## 6. Free model and monetization

The closet, manual composition, and saved looks must provide lasting free value. Generative visualization is the premium product.

Current direction:

- two initial free renders to demonstrate quality before selling;
- monthly and annual subscriptions that include a defined number of generations per month;
- failure and regeneration policy still to be defined;
- no weekly subscription at launch;
- credit packs are not a launch priority;
- unused allowance does not roll over at launch;
- no “unlimited” positioning until costs and abuse are under control.

Selling can be direct and ambitious while remaining consistent with a premium brand: clear pricing, tangible value, a visible close action, purchase restoration, and no fake urgency.

### AI cost estimates — July 20, 2026

These figures are official API prices in USD, not WearBloom's fully loaded cost. Input images, internal retries, storage, bandwidth, observability, and reimbursed renders must be added.

| Model | Indicative output | Output cost | 20 renders |
|---|---:|---:|---:|
| GPT Image 2, medium portrait | 1024×1536 | $0.041 | $0.82 |
| GPT Image 2, high portrait | 1024×1536 | $0.165 | $3.30 |
| Nano Banana 2 | 1K | $0.067 | $1.34 |
| Nano Banana 2 | 2K | $0.101 | $2.02 |
| Nano Banana Pro | 1K/2K | $0.134 | $2.68 |
| Nano Banana Pro | 4K | $0.24 | $4.80 |

Google also lists approximately $0.0011 per input image for Nano Banana Pro. With one person photo and three garments, a 1K/2K render would therefore cost approximately $0.1384 before other costs, or about $2.77 for 20 renders.

GPT Image 2 charges $8 per million input-image tokens and processes references in high fidelity. Exact cost therefore depends on image dimensions and the number of garments. The OpenAI figures in the table represent output cost only.

Google positions Nano Banana 2 as its general-purpose model for multiple references, while Nano Banana Pro targets the most complex visual tasks. The launch provider and model are selected through direct product evaluation on representative consented photos. The selection optimizes **cost per accepted render**, not cost per successful request.

As an illustrative scenario, a $9.99 subscription leaves approximately $8.49 before taxes for a developer eligible for the App Store Small Business Program's 15% commission. Even 20 Nano Banana Pro 1K/2K renders would represent approximately $2.77 in direct AI cost with four input images, leaving an attractive theoretical gross margin. This margin must still be validated against real regeneration and failure rates.

## 7. Distribution and viral loop

WearBloom begins without an existing audience. Distribution is therefore a first-class product problem, not a step that happens after development.

Every strong render should be able to become elegant vertical social content:

- 9:16 export for TikTok, Reels, and Stories;
- before-and-after or transition from composed garments to rendered look;
- discreet but recognizable WearBloom watermark;
- ready-to-post video template that requires no external editing;
- deep link to the app or App Store page;
- explicit consent before any publication;
- potentially reserve a clean export for the paid offering without degrading free sharing.

Virality must give the recipient a reason to try the product herself rather than merely display a logo. Example loop: “I styled this from my own closet” → visual transition → “Try your closet on.”

Chosen direction: sharing should primarily make the recipient want to create her own look. The product vision includes a public link-only page and voting between multiple looks. The watermark may remain on every export if treated as a desirable editorial signature rather than intrusive advertising.

### “Help me pick” experience

Initial sharing prioritizes a comparison between two looks:

1. the user selects Look A and Look B;
2. she previews exactly what will become public;
3. WearBloom creates a 9:16 Story/Reel and, when enabled, a link-based voting page;
4. the recipient votes for A or B without creating an account;
5. after voting, the primary call to action is “Create your look in WearBloom.”

The page has no free-form comments, public profile, or global social counter at launch. Reactions remain lightweight and positive. The link is unindexed, revocable, and reshareable, so the app must explain that a recipient can forward it.

Voting results appear only after a vote to avoid influencing the choice. A voting page expires after seven days by default; its owner may close it immediately or keep it longer. Voting requires no account and collects no free-form comment.

A personal render is published only after explicit consent. The user can instead share only the garment collage if she does not want her photo to become visible.

The initial US launch relies on an organic strategy with no paid media budget or paid UGC. WearBloom must make it easy to produce internal demonstrations, transformations, tutorials, and social videos from consented test looks. This content tooling belongs to launch strategy rather than the core user product.

The viral-loop metrics are: share rate after a strong render, views or clicks per share, attributed installs, first render completed, and conversion among users acquired through sharing.

## 8. Selected technical architecture

### 8.1 Principles

- The app is native iOS and contains no AI secret.
- Identity and subscriptions are not implemented with homegrown systems.
- The target deployment uses a VPS to host the API, Better Auth, business data, images, renders, and public pages.
- PostgreSQL is the business source of truth; SwiftData is a cache and draft workspace.
- The OpenAPI HTTP contract is the typed boundary between Swift and TypeScript.
- External providers remain replaceable behind internal interfaces.
- The launch architecture optimizes for simple operation on one server and introduces no Redis, Kubernetes, or microservices.

### 8.2 Repository

One repository contains the client, server, and contract:

```text
wearbloom/
├── ios/
│   ├── WearBloom.xcodeproj
│   ├── WearBloom/
│   └── WearBloomTests/
├── server/
│   ├── src/
│   ├── migrations/
│   ├── test/
│   ├── Dockerfile
│   └── package.json
├── contracts/
│   └── openapi.yaml
├── infrastructure/
│   ├── compose.local.yaml
│   └── dokploy.md
└── PRD.md
```

The project is initialized in this monorepo. All code, schemas, and data required for operation are created exclusively from this specification.

### 8.3 iOS client

- latest stable Xcode toolchain and iOS SDK available at implementation time; the initial baseline is Xcode 26.6, Swift 6.3, and the iOS 26 SDK;
- Swift 6 with strict concurrency;
- SwiftUI;
- iOS 26.0 minimum deployment target;
- Swift Concurrency with `async/await` and cancellable tasks;
- Observation with `@Observable` for interface state;
- SwiftData for drafts, closet cache, and a minimal local queue;
- PhotosUI for import;
- Vision for local background removal;
- AuthenticationServices for the Sign in with Apple interface;
- internal Better Auth client built on URLSession;
- Keychain Services for the Better Auth session token;
- App Attest for attesting expensive requests;
- RevenueCat Purchases SDK for subscriptions;
- Swift OpenAPI Generator with URLSession transport for the API;
- UserNotifications/APNs for completed renders;
- OSLog for local logs;
- Sentry Cocoa for crashes and performance;
- PostHog iOS for product events, funnels, and feature flags;
- Swift Testing for unit tests and XCTest/XCUITest for UI tests.

WearBloom is designed for the latest stable generation of iOS rather than for broad backward compatibility. The production app uses stable SDKs only; beta SDKs may be used for exploratory testing but never as the shipping baseline. The initial implementation does not provide alternative UI implementations or compatibility fallbacks for iOS 18 through iOS 25. The deployment target is reconsidered only when preparing a later release against a newer stable major version of iOS.

The UI is Apple-native by default. WearBloom uses SwiftUI and Apple platform frameworks for navigation, controls, layouts, sheets, gestures, animations, transitions, haptics, accessibility, image processing, and system integrations. UIKit may be bridged through SwiftUI when an Apple capability is not exposed directly in SwiftUI.

WearBloom does not adopt a third-party design system, general-purpose component library, image-loading UI framework, or animation runtime in the initial implementation. Its visual identity is implemented in the internal `DesignSystem` module through semantic tokens, branded SwiftUI components, motion primitives, image treatments, and accessibility behavior. RevenueCat, Sentry, and PostHog are infrastructure SDKs and do not supply the product's interface; in particular, the subscription and paywall screens are custom WearBloom SwiftUI views.

#### Selected visual direction

The primary visual reference for the initial product is the selected mock at `design-directions/06-selected-direction.html`. The mock's former working title is not a product name, feature name, or candidate brand name and must not appear in the shipped interface.

The implementation uses this mock as a source of art direction rather than as a pixel-perfect web specification. The reference establishes:

- an organic, collage-led composition with floating garment cards and a warm, personal feel;
- an energetic palette led by electric violet and acid lime, with coral, warm neutral, and near-black supporting colors;
- an expressive editorial serif paired with a clear geometric sans serif, prototyped with Fraunces and Space Grotesk;
- rounded, tactile surfaces combined with confident outlines, offset shadows, and a small amount of graphic tension;
- a supportive, creative, and more assertive voice rather than a cold luxury or purely utilitarian tone;
- image-first create and reveal screens that retain clear native actions, privacy messaging, generation rules, and accessible contrast.

The device frame, browser navigation, proposal labels, and comparison-page chrome are presentation scaffolding and are not part of the app design system. Production recreates the visual principles with semantic SwiftUI tokens and native components. Final typeface selection must confirm licensing, performance, legibility, Dynamic Type behavior, and localization support before release.

The initial image pipeline uses Apple frameworks only. Personal photos and closet images are local-first. Server-hosted renders and required thumbnails are downloaded with URLSession, persisted locally, downsampled with ImageIO to their display size, and served through a bounded memory and disk cache owned by `Core/Images`. The interface does not depend on transient signed URLs remaining valid after the first successful download.

A focused third-party UI-adjacent dependency may be proposed later only after profiling or a concrete product requirement demonstrates that the native implementation is insufficient. Adoption requires an explicit update to this PRD, a documented benefit, Swift Package Manager distribution, support for the deployment target and Swift strict concurrency, an internal abstraction boundary, accessibility verification, and a viable removal path. The implementation agent must not add such a dependency preemptively.

Feature-based organization:

```text
WearBloom/
├── App/
├── Core/
│   ├── API/
│   ├── Auth/
│   ├── Persistence/
│   ├── DesignSystem/
│   ├── Images/
│   ├── Purchases/
│   └── Analytics/
├── Features/
│   ├── Onboarding/
│   ├── Closet/
│   ├── CreateLook/
│   ├── LookReview/
│   ├── Rendering/
│   ├── Looks/
│   ├── Sharing/
│   ├── Subscription/
│   └── Settings/
└── Resources/
```

Each feature contains its views, `@Observable` model, and tests. Network, local database, purchase, analytics, and image dependencies are defined as protocols and injected so tests can use deterministic fakes.

### 8.4 Authentication and abuse protection

**Better Auth is the sole identity implementation.** WearBloom self-hosts the library in its Hono/PostgreSQL server but creates no custom authentication algorithm, password system, or proprietary token format.

Allowed Better Auth configuration:

- exact version pinned in the lockfile;
- only the `anonymous` and `bearer` plugins;
- Apple as the only social provider;
- email and password authentication disabled;
- signed bearer tokens with `requireSignature: true`;
- sessions stored in PostgreSQL, expiring after seven days with sliding renewal;
- versioned and rotatable Better Auth secret;
- trusted origins limited to WearBloom domains, Apple, and the app's documented URL scheme;
- origin validation, CSRF checks, and the Apple nonce must never be disabled.

Flow:

1. when the app first needs the server, it calls the Better Auth anonymous sign-in route;
2. it reads the session token from the `set-auth-token` response header and stores it only in Keychain;
3. it attaches the token as `Authorization: Bearer` to every API request;
4. server middleware calls `auth.api.getSession` and uses the Better Auth user ID as the canonical owner;
5. after revealing the first result, the app offers Sign in with Apple;
6. AuthenticationServices obtains the Apple ID token with a cryptographic nonce; the app sends the token and nonce to Better Auth while remaining authenticated as the anonymous user;
7. the `anonymous` plugin invokes `onLinkAccount`; a PostgreSQL transaction reassigns the closet, looks, variants, quota, and subscription to the Apple identity before deleting the anonymous identity;
8. when the Apple identity already exists, the same transaction merges the anonymous data without duplicating the free allowance; the operation is idempotent.

The Swift authentication interface is deliberately limited to `signInAnonymously`, `linkOrSignInWithApple`, `currentSession`, `signOut`, and `deleteAccount`. It calls the Better Auth HTTP endpoints documented in the repository contract. No second client-side authentication implementation is allowed.

App Attest uses a server challenge and assertions verified by the API for uploads and render requests. It reduces calls from forged clients but does not replace rate limiting or quotas. Assertions are never treated as user identity.

Better Auth anonymous accounts older than 30 days with no activity or business data are removed. The two free renders are granted once per identity. At launch, a sophisticated reinstall may bypass this limit; abuse is measured before introducing a more intrusive fingerprint.

### 8.5 Subscriptions

**RevenueCat is the commercial source of truth for entitlements.** WearBloom does not implement its own StoreKit validation or App Store Server Notifications handling.

- RevenueCat entitlement: `pro`;
- initial products: monthly and annual subscriptions;
- remotely configurable offerings and paywalls in RevenueCat;
- purchase restoration available from the paywall and Settings;
- authenticated, idempotent RevenueCat webhooks sent to the server;
- local PostgreSQL entitlement table updated by webhook and reconciled with RevenueCat on demand;
- the client may display the RevenueCat entitlement, but the server always decides whether a generation is allowed;
- allowance of 20 generations per month;
- the annual subscription uses monthly allowance periods anchored to the purchase date;
- unused allowance does not roll over at launch;
- a generation is consumed only after a technically successful result;
- consumption operations are transactional and idempotent.

Paywall tests use RevenueCat Experiments. PostHog may select a copy, screen-order, or presentation variant already compiled into the app, but it never changes a price, server quota, or access right.

### 8.6 API and contract

- REST JSON under `/v1`;
- `multipart/form-data` uploads;
- OpenAPI 3.1;
- Swift client generated with Swift OpenAPI Generator;
- UUIDv7 identifiers generated by the server;
- ISO 8601 UTC dates in the API and `timestamptz` in PostgreSQL;
- cursor pagination;
- `requestId` on every response;
- structured errors: `{ code, message, requestId, details? }`;
- stable business codes; never parse user-facing text;
- actual image type and size validated on the server;
- every expensive mutation accepts an idempotency key.

The OpenAPI document is generated from server schemas and checked into `contracts/openapi.yaml`. CI fails if the checked-in file diverges or if the Swift client no longer compiles against the contract.

### 8.7 Backend

- strict TypeScript;
- Bun as runtime, package manager, and test runner;
- Hono;
- `@hono/zod-openapi` and Zod for validation and contract generation;
- Better Auth with the PostgreSQL/Drizzle adapter;
- Drizzle ORM;
- PostgreSQL 16 on the VPS;
- server-side App Attest verification for expensive routes;
- RevenueCat through webhooks and the server REST API;
- Sentry for API and worker errors and traces;
- Pino with JSON output;
- Docker;
- Dokploy and Traefik for deployment and HTTPS.

The server is a modular monolith with two process modes built from the same Docker image:

- `api`: HTTP, uploads, public pages, and webhooks;
- `worker`: AI generations, cleanup, share expiration, and maintenance.

There is no Redis or message broker. PostgreSQL hosts the `render_jobs` queue. The worker claims jobs with transactional locks, a heartbeat, and recovery of abandoned jobs. Every state transition is idempotent.

### 8.8 AI providers

Single server interface:

```text
ImageGenerationProvider
├── OpenAIImageProvider
└── GeminiImageProvider
```

Each implementation receives a reference photo, an ordered garment list, and composition context. It returns a provider ID, a result, or a typed error.

The active provider, model, resolution, and prompt version are configured in Dokploy. Changing providers does not require an App Store release. Per-render metrics include model, estimated cost, latency, input count, acceptance status, and rejection reason.

The selected launch configuration is the default. The other provider remains a disabled fallback, not a second automatic route that would silently double costs.

### 8.9 Images and storage

Initial storage uses a persistent VPS Docker volume behind an `ImageStorage` interface. MinIO is not installed.

- private originals are never accessible through a public URL;
- filenames are generated by the server and never derived from user input;
- thumbnails and derivatives are stored separately;
- short-lived signed URLs or authenticated endpoints;
- share renders are copied to a dedicated public area only after consent;
- two-phase deletion: database marking followed by idempotent cleanup;
- full account deletion includes files, business rows, and the Better Auth identity;
- limits on file size, dimensions, and image count;
- daily logical PostgreSQL backups and daily archives of the image volume stored in a dedicated backup volume on the same VPS for the MVP;
- retention of seven daily backups and four weekly backups, with automatic pruning;
- documented restoration test before public launch;
- the MVP explicitly accepts that a same-VPS backup does not protect against loss of the server or its disk. Off-VPS encrypted backups are introduced after initial product validation and before infrastructure scale-up.

`ImageStorage` must be replaceable later with S3 or R2 without changing routes or the business model.

### 8.10 Public pages and links

`Help me pick` pages are rendered server-side with Hono, without React or Next.js.

- opaque URL at `wearbloom.app/l/{slug}`;
- lightweight HTML with Open Graph metadata;
- `noindex, nofollow`;
- seven-day expiration;
- revocation;
- rate-limited anonymous voting;
- no private photo becomes public without an explicit copy into the sharing area;
- Smart App Banner, universal link, and App Store call to action;
- install attribution through a non-sensitive share identifier.

### 8.11 Analytics, crashes, and privacy

**Sentry answers “Why did the app break or slow down?”** It collects crashes and performance traces from the iOS client, API, and worker. All three components share `requestId`, `renderJobId`, and a pseudonymous user ID to trace a failure end to end. Attachments, screenshots, server local variables, request bodies, tokens, signed URLs, prompts, and images are excluded. CI uploads dSYMs and source maps.

**PostHog answers “How do users use the product, and where do they drop off?”** The iOS SDK covers product events, funnels, cohorts, retention, feature flags, and experiments. The backend sends events whose acceptance must be confirmed by the server. A versioned catalog defines event names, allowed properties, and owners; the implementation agent does not create ad hoc names.

Minimum launch events:

- `onboarding_started`, `onboarding_step_completed`, `onboarding_completed`;
- `person_photo_added`, `garment_added`, `look_composed`;
- `render_requested`, `render_succeeded`, `render_failed`, `render_revealed`;
- `paywall_viewed`, `purchase_started`, `purchase_succeeded`, `purchase_failed`, `purchase_restored`;
- `look_shared`, `public_look_opened`, `vote_submitted`.

No photo, image URL, free-form text, garment name, prompt, token, Apple data, or voting content is sent to PostHog or Sentry. Properties are bounded values only: pseudonymous identifiers, categories, counts, durations, variants, and error codes.

PostHog Session Replay remains disabled in the first App Store release because WearBloom displays personal photos of users' bodies and clothes. It may be enabled on TestFlight in wireframe mode only. Production activation requires a masking audit, screenshot mode disabled, explicit masking of every image and free-form text view, and a maximum 10% sample.

PostgreSQL stores business events that require server-side truth: generations, costs, quotas, webhooks, shares, votes, and attributed conversion. PostHog is never the source of truth for a purchase, quota, or entitlement.

WearBloom uses PostHog Cloud in the EU region at launch. Self-hosting is not selected because of its operational cost and hardware requirements; the SDK and event schema remain hosting-independent. A PostHog billing limit is configured before adding any payment card.

At launch, WearBloom uses no advertising, advertising identifier, or cross-app tracking. No App Tracking Transparency prompt is displayed while that remains true. App Privacy declarations must reflect Better Auth, RevenueCat, Sentry, PostHog, diagnostics, purchases, and photos sent to the service. Analytics consent and deletion requests follow the requirements of every distributed territory.

### 8.12 Internationalization and future translation

The launch release is available only in US English (`en-US`), which remains the source language and ultimate fallback. The architecture is nevertheless localizable from the first commit.

#### iOS client

- all visible copy is defined in an Xcode String Catalog at `Localizable.xcstrings`;
- every entry uses a stable semantic key, an English default value, and a context comment, for example `onboarding.first_render.title`;
- no visible sentence is hard-coded in a view or view model;
- sentences are never assembled through concatenation; variables, plurals, and grammatical variations belong in the catalog;
- dates, times, numbers, percentages, and lists use Foundation `FormatStyle` with the current locale;
- displayed subscription prices and periods come from localized StoreKit/RevenueCat values, never from a hard-coded price;
- APNs notifications use `loc-key` and `loc-args` from the bundled catalog rather than an English sentence sent by the server;
- views use `leading` and `trailing`, Dynamic Type, and flexible dimensions to support longer text and a future right-to-left language;
- no text required to use the product is embedded in an image.

The app follows the system language. No in-app language selector is built at launch; iOS provides per-app language settings when multiple localizations are shipped.

#### Data and API

- categories, states, error codes, and analytics events use stable canonical technical-English identifiers such as `top` and `render_failed`; they are never translated in the database;
- the client localizes API error codes through its String Catalog; the server does not use an English sentence as a business contract;
- free-form garment and look names created by the user are never translated automatically;
- interface language does not implicitly change the AI prompt version, which is versioned separately;
- the app sends a BCP 47 locale in `Accept-Language` and syncs `preferredLocale` to the profile for server communications;
- PostHog stores `app_locale` as a bounded property, while event names remain identical in every language.

The small amount of server-rendered copy, particularly on public `Help me pick` pages, uses typed TypeScript dictionaries under `server/src/i18n/`. `en-US` defines the canonical key set, and every new locale must satisfy the same type at compile time. A public page resolves its locale in this order: supported explicit parameter, supported browser language, locale saved when the share was created, then `en-US`.

#### Future translation pipeline

Adding a language requires no data-model or API-route change:

1. add the locale to the String Catalog and server dictionary;
2. export only missing keys with their English source, comment, screen, and variables;
3. produce a first proposal with a translation model or vendor;
4. reimport translations and fail CI when a key, variable, plural, or technical limit is missing;
5. have a human review onboarding, paywall, trust copy, notifications, and all legal content;
6. run pseudolocalization, XCUITest, and screenshots in the new language;
7. localize App Store metadata, keywords, and screenshots separately before release.

Runtime machine translation inside the app is forbidden. PostHog may select a bundled variant key but cannot inject arbitrary copy. Legal and commercial copy is never published directly from an unreviewed AI output.

### 8.13 Deployment

```text
VPS / Dokploy / Traefik
├── api.wearbloom.app      → wearbloom-api
├── wearbloom.app/l/*      → wearbloom-api (public pages)
├── wearbloom-worker
├── PostgreSQL 16
├── private image volume
└── backup job
```

- versioned SQL migrations; never run `drizzle-kit push` in production;
- separate API health check and worker heartbeat;
- secrets stored only in Dokploy;
- no private Better Auth, Apple, RevenueCat, Sentry, PostHog, or AI key in Git or the app; only DSNs or public tokens explicitly designed for client SDKs may be embedded;
- non-root multi-stage Docker image;
- deploy to staging, run smoke tests, then promote the same Docker image to production;
- retain the previous server image for an application rollback compatible with the migrations;
- GitHub CI: format, lint, typecheck, tests, OpenAPI generation, server build, and iOS tests;
- deploy the server after merge to `main`;
- deliver iOS through Xcode Cloud or GitHub Actions with Fastlane, then TestFlight and the App Store.

### 8.14 Explicitly rejected stack

- homegrown authentication;
- Firebase Authentication, Analytics, Crashlytics, and Remote Config;
- homegrown StoreKit server implementation at launch;
- Expo, React Native, or EAS;
- tRPC;
- self-hosted Supabase;
- Firebase Firestore or Storage as the product database;
- Vapor on the server;
- Next.js or a separate web frontend;
- Redis or Kafka;
- Kubernetes;
- MinIO on a single VPS;
- calling the AI provider directly from the iPhone.

## 9. Priority open decisions

1. **Initial segment:** Which English-speaking women's subculture or situation should guide the first organic content?
2. **Reference photo:** Preserve the original background, normalize to an editorial setting, or offer multiple modes?
3. **Paywall:** Blur the third result or block generation before it starts?
4. **Final price:** $9.99, $12.99, or $14.99 per month after initial render evaluation and interviews?
5. **Quality reimbursement:** Manual goodwill adjustment or controlled regeneration, with no automatically exploitable refund?
6. **Infrastructure capacity:** The MVP uses same-VPS backups as specified above. Reassess disk capacity and RAM before public scale-up.
