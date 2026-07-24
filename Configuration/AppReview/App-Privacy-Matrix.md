# WearBloom App Privacy matrix

This matrix describes the Release build and must match App Store Connect. Optional
analytics and diagnostics remain disclosures even though collection is off by
default.

| Data type | Linked | Tracking | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Photos or Videos | Yes | No | App Functionality | Selected garment/reference photos and generated previews |
| Other User Content | Yes | No | App Functionality | Garment names, look names/notes, and preview feedback |
| User ID | Yes | No | App Functionality, Analytics | Private account ID; analytics only after opt-in |
| Email Address | Yes | No | App Functionality | Optional Sign in with Apple email |
| Device ID | Yes | No | App Functionality | App Attest key and optional telemetry device/session identifiers |
| Purchase History | Yes | No | App Functionality | Product, transaction, status, and expiration |
| Product Interaction | Yes | No | Analytics | Optional PostHog product events |
| Other Usage Data | Yes | No | Analytics | Optional PostHog app-lifecycle events |
| Crash Data | Yes | No | App Functionality | Optional Sentry diagnostics |
| Performance Data | Yes | No | App Functionality | Optional Sentry performance/app-hang data |
| Other Diagnostic Data | Yes | No | App Functionality | Optional Sentry reliability data |

No advertising identifiers, cross-app tracking, session replay, photos, prompts,
Apple tokens, or free-form content are sent to PostHog or Sentry.

## Release verification

- Compare this matrix with the final `PrivacyInfo.xcprivacy` and every embedded
  SDK privacy manifest.
- Enter the same answers in App Store Connect under App Privacy.
- Recheck the matrix whenever an SDK, event property, or data flow changes.
