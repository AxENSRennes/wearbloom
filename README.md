# WearBloom

WearBloom is being rebuilt as a native iOS application using SwiftUI.

The product and technical source of truth is [PRD.md](PRD.md). The repository intentionally contains only the specification and bootstrap configuration until the native application is generated.

The previous Expo/full-stack implementation remains available in Git history and under the `legacy-web-app` tag.

## Local configuration

Copy `.env.example` to `.env` and supply local values. Never commit `.env`, signing credentials, provider secrets, or CI tokens.

## Continuous integration

`.github/workflows/ios.yml` automatically detects the first Xcode workspace or project and builds the `WearBloom` scheme for a generic iOS Simulator. Before the Xcode project exists, the workflow succeeds with an explicit bootstrap-pending message.
