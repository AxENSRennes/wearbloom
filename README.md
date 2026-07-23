# WearBloom

WearBloom is a native SwiftUI app for composing looks from a private closet and creating personal outfit previews. This repository contains the iOS app, Bun API and worker, PostgreSQL migrations, OpenAPI contract, public association/privacy site, and Dokploy deployment template described by [PRD.md](PRD.md).

Open `WearBloom.xcodeproj` and run the shared `WearBloom` scheme. The app uses Swift 6 strict concurrency and iOS 26. Debug builds use an explicitly labeled on-device preview when `API_BASE_URL` is empty. Configure the API to exercise private uploads, category detection, queued AI generation, server quotas, feedback, and deletion.

StoreKit and App Store Server setup is documented in `docs/app-store-subscriptions.md`; production deployment, smoke checks, rollback, and backups are documented in `docs/operations.md`.

## Local server

Copy `server/.env.example` to `server/.env` and supply local values. From `server`, run:

```sh
bun install
bun run typecheck
bun test
bun run db:migrate
bun run dev
```

Run the worker separately with `bun run worker`, or use `docker compose up`. Never commit signing credentials, provider secrets, or CI tokens.

## Verification

The shared Xcode scheme includes Swift Testing coverage for the composition rules. `.github/workflows/ios.yml` runs strict TypeScript checks, server tests, OpenAPI drift checks, a production Docker build, and the iOS test suite.
