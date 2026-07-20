# WearBloom — Product Requirements Document

**Status:** Product and technical specification  
**Date:** July 20, 2026  
**Objective:** Define the product, launch scope, key rules, and technical choices required to build WearBloom.

This PRD is the source of truth for product intent and fixed constraints. The selected visual direction at `design-directions/06-selected-direction.html` is its companion art-direction reference. Implementation details may evolve when a better solution is discovered, provided that the product behavior, privacy, and architectural constraints below remain intact.

## 1. Vision and positioning

WearBloom is a native iPhone app built with SwiftUI. It helps a user compose a look from clothes she owns, then generate an image of herself wearing that look.

The launch product is in English, with the United States as its first market and women as its initial audience. WearBloom has a premium, editorial, fashion-led identity. It should create confidence and inspiration without claiming to predict exact fit, sizing, drape, or body shape.

> Compose a look from your own closet, then see it on you.

The commercial hypothesis is that a credible first personal render will make users want to try more looks and pay for continued generation.

## 2. Product principles and success

- WearBloom composes a complete look, not a single isolated garment.
- One garment is active per category. A dress replaces top + bottom; outerwear remains optional.
- The first personal result requires only one user photo and the selected garments, not a complete closet import.
- The first meaningful result uses the user's own photo. Stock images may demonstrate the product but do not replace personal value.
- Closet management, manual composition, and saved looks remain useful for free; image generation is the premium feature.
- A technical failure never consumes a generation.
- Personal photos are private by default and never become public without explicit consent.

The primary product signals are completion of the first personal render, whether the result looks credible and helps the user decide, voluntary creation of another render, retention, conversion, and cost per useful render.

## 3. MVP product

### Primary journey

1. The user understands the result WearBloom can create.
2. She selects or takes a photo of herself.
3. She adds the garments she wants to combine.
4. WearBloom detects garment categories and lets her correct them quickly.
5. She reviews the composition and starts a render.
6. WearBloom communicates the wait honestly and allows her to leave while the render continues.
7. She sees the result and answers whether it looks like her and helps her decide.
8. She can replace a garment, save the look, share the result, or create another render.
9. Account creation or purchase appears only when it protects or extends value.

### Navigation

The launch app has three tabs:

1. **Closet** — saved garments and adding garments;
2. **Create** — the default tab for composing a look;
3. **Looks** — saved compositions and generated results.

Profile, subscription, privacy, and settings are accessible outside the main tab bar. The exact screen hierarchy and controls may evolve during implementation as long as the primary journey remains direct.

### Functional scope

- import from Photos and Camera with a simple photo guide;
- compose a look from multiple primary garments;
- automatically detect garment categories with user correction;
- save, edit, and delete garments and looks;
- generate a personal render asynchronously;
- keep multiple reference photos and select a default;
- reuse a previous render as a clearly labeled generated reference;
- preserve each generated result as a separate variant rather than overwriting it;
- save or share a result with clear privacy messaging;
- collect product feedback;
- delete remote user data from the app;
- instrument the product funnel, performance, and failures.

A **Look** is the user's editable composition. A **Render Variant** is an immutable record of one generation and the inputs that produced it. Editing a look never destroys its previous variants.

Garment background removal is local and non-blocking. WearBloom uses the original or a clean crop when local removal fails; a server-side fallback may be added later if it materially improves the product.

### Onboarding and reveal

Onboarding should move the user quickly toward her first personal result while creating desire, explaining photo privacy, and reducing uncertainty. The exact number and order of screens are decided through implementation. Rendering progress must be honest, and a long render can continue after the user leaves the screen, with a completion notification when appropriate.

### Out of scope at launch

- mandatory import of the entire closet;
- shoes, bags, accessories, complex layering, and calendar planning;
- Android;
- a complete offline mode or general-purpose sync engine;
- an admin dashboard;
- credit packs, weekly subscriptions, or unlimited generation;
- affiliate features, coaching, weather, streaks, or marketing notifications;
- multiple simultaneously active AI providers;
- public profiles, comments, or a social network.

## 4. Monetization

The working launch model is two free renders followed by monthly and annual subscriptions. The working paid allowance is 20 generations per month, but the allowance, products, and prices must remain configurable because they will change with observed usage, quality, and cost.

The paywall appears when the user has exhausted her free or paid allowance. A partially blurred result may be explored as a presentation idea, but it is not a fixed launch requirement and must never mislead the user about what she already owns. Pricing is clear, restoration is available, closing the paywall is visible, and the product uses no fake urgency.

Unused allowance does not roll over in the working model. A technically failed generation is not deducted; the exact recovery policy for a low-quality but technically valid result remains configurable.

RevenueCat manages App Store products, offerings, purchases, restoration, and the `pro` entitlement. The paywall must match WearBloom's visual direction and use localized product information from RevenueCat, but its exact implementation may evolve. The server remains responsible for deciding whether a generation is allowed and for applying quotas idempotently.

## 5. Distribution and viral loops

Sharing should make a recipient want to create her own look, not merely expose a logo. The MVP should make strong results easy to save or share as elegant vertical content with explicit consent and discreet WearBloom attribution.

After the MVP, WearBloom may add private, revocable share pages for asking friends to choose between two looks. A recipient could vote without an account and then be invited to create her own look. These pages should remain link-only, lightweight, privacy-conscious, and free of public profiles or comments.

The important signals are the share rate after a useful render, opens or views per share, attributed installs, first renders, and conversion from shared content.

## 6. Visual direction

The selected reference is `design-directions/06-selected-direction.html`. It defines art direction rather than a pixel-perfect web specification.

The product should feel organic, energetic, tactile, and fashion-led: collage-based layouts, electric violet and acid lime with warm supporting colors, editorial typography paired with a clear sans serif, confident outlines and shadows, image-first screens, and a supportive but assertive voice. The implementation remains native SwiftUI and must preserve clarity, accessibility, and the selected visual character.

## 7. Technical architecture

### Principles

- Native iOS app with no private AI or server secret in the client.
- One repository for the iOS app, server, API contract, and deployment configuration.
- PostgreSQL is the business source of truth; SwiftData supports local drafts and caching.
- A typed OpenAPI contract connects the Swift client and TypeScript server.
- Authentication, subscriptions, storage, analytics, and AI providers remain behind internal boundaries so they can be replaced without rewriting the product.
- The launch backend is a simple modular monolith on one VPS, with no Redis, Kafka, Kubernetes, or microservices.

### iOS client

The iOS app uses Swift 6 with strict concurrency, SwiftUI, SwiftData, Swift Concurrency, and the latest stable iOS 26 SDK available during implementation.

Use Apple frameworks where appropriate, including PhotosUI, Vision, AuthenticationServices, Keychain Services, App Attest, UserNotifications/APNs, ImageIO, and OSLog. RevenueCat handles purchases, Swift OpenAPI Generator provides the API client, Sentry captures errors and performance, PostHog captures product analytics, and Swift Testing/XCTest cover automated tests.

The codebase follows a feature-based organization. The implementation agent chooses the exact modules and folder structure. The interface should remain Apple-native and use additional UI dependencies only when they solve a concrete problem better than platform frameworks.

### Authentication and abuse protection

Better Auth provides anonymous sessions followed by optional Sign in with Apple. Session credentials are stored in Keychain, anonymous data is preserved when an account is linked, and account merging must never duplicate free allowance. Authentication, ownership, quotas, and paid access are always enforced by the server.

App Attest protects uploads and expensive render requests alongside rate limits and quotas. It is not treated as user identity. The MVP accepts that sophisticated reinstall abuse may exist and measures it before adding intrusive fingerprinting.

### API, backend, and AI

The server is a strict-TypeScript modular monolith built with Bun, Hono, Zod/OpenAPI, Drizzle, and PostgreSQL. The same Docker image can run as an HTTP API or as a worker for asynchronous renders and maintenance. PostgreSQL may hold the job queue; no separate broker is required at launch.

The REST API is versioned under `/v1` and described by OpenAPI. The server validates uploads and business inputs, returns structured errors and request identifiers, and makes expensive or retryable mutations idempotent.

A server-side vision-language model detects garment categories and returns suggestions that the user can correct.

Image generation uses one internal provider interface. OpenAI and Gemini can be evaluated and interchanged behind that interface, while only one provider and model are active at a time. Provider, model, resolution, and prompt version are production configuration rather than App Store release decisions.

### Images and storage

Personal images are local-first and private by default. Server-side originals and renders use private storage behind a replaceable storage interface and are exposed only through authenticated or short-lived access. A public copy is created only after explicit sharing consent.

Deleting a variant, look, or account removes the associated business data and files through an idempotent cleanup process. File type, size, dimensions, and count are validated server-side.

### Analytics, crashes, and privacy

Instrument WearBloom generously with Sentry and PostHog so every important user action, funnel step, render, failure, and performance issue can be understood end to end. Collect as much structured context as useful, but never photos, free-form content, prompts, tokens, or secrets. Session Replay may be used only when all sensitive content is reliably masked.

PostgreSQL remains the source of truth for purchases, quotas, generations, costs, and other business state. WearBloom uses no advertising identifier or cross-app tracking at launch.

### Internationalization

The launch app uses US English and stores user-facing copy in an Xcode String Catalog rather than hard-coding it in views. Layouts, formatted values, server error codes, and public copy should allow additional languages later without redesigning the data model or API.

## 8. Deployment and operations

```text
VPS / Dokploy / Traefik
├── api.wearbloom.app      → wearbloom-api
├── wearbloom.app          → Apple association file and future private pages
├── wearbloom-worker
├── PostgreSQL 16
├── private image volume
└── backup job
```

- Docker and Dokploy deploy the API and worker behind Traefik with HTTPS.
- Database changes use versioned SQL migrations; production never uses schema push.
- The API has a health check and the worker has a heartbeat.
- Private secrets live only in Dokploy or CI secret storage. Only client-safe public SDK values may be embedded in the app.
- Production images are non-root, multi-stage, and reproducible.
- Deploy to staging, run smoke tests, and promote the same image to production.
- Retain a previous compatible image for rollback.
- CI runs formatting, linting, type checks, tests, OpenAPI generation, server build, and iOS tests.
- Merge to `main` deploys the server through the configured pipeline.
- iOS delivery uses Xcode or GitHub Actions/Fastlane, followed by TestFlight and the App Store.
- PostgreSQL and the private image volume are backed up automatically with retention and a tested restoration procedure.
- Same-VPS backups are acceptable during initial development; encrypted off-VPS backups are required before meaningful public scale.
- `wearbloom.app` serves the Apple association file required by Universal Links and can later serve private sharing pages.

Use the Dokploy MCP when inspecting or changing the VPS. Throughout implementation, consult the latest official documentation for every technology and API rather than relying on outdated examples or assumptions. Existing WearBloom code or services on the VPS are legacy and may be discarded and rebuilt cleanly when they conflict with this PRD.

## 9. Configurable decisions

These choices may change without rewriting the architecture and should not block implementation:

- active AI provider, model, resolution, and prompt version;
- final subscription prices and monthly allowance, with 20 as the working default;
- exact paywall presentation, including the possible use of a blurred result after allowance is exhausted;
- recovery or regeneration policy for low-quality results;
- whether generated scenes preserve the original background or use a consistent editorial treatment;
- the initial audience segment used for organic content.

## 10. Definition of completion

The app is considered complete only when it is an ambitious implementation of this PRD, has been tested end to end in the iOS Simulator against these requirements, and is ready and eligible for publication on the App Store.
