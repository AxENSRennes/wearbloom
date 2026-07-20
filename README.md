# WearBloom

WearBloom is being rebuilt as a native iOS application using SwiftUI.

Open `WearBloom.xcodeproj` and run the shared `WearBloom` scheme. The initial target uses Xcode 26.6, Swift 6 strict concurrency, and iOS 26 as specified by the PRD.

RevenueCat setup and dashboard instructions are documented in `docs/revenuecat-ios.md`.

The product and technical source of truth is [PRD.md](PRD.md). The repository intentionally contains only the specification and bootstrap configuration until the native application is generated.

The previous Expo/full-stack implementation remains available in Git history and under the `legacy-web-app` tag.

## Local configuration

Copy `.env.example` to `.env` and supply local values. Never commit `.env`, signing credentials, provider secrets, or CI tokens.

## Continuous integration

`.github/workflows/ios.yml` automatically detects the first Xcode workspace or project and builds the `WearBloom` scheme for a generic iOS Simulator. Before the Xcode project exists, the workflow succeeds with an explicit bootstrap-pending message.
