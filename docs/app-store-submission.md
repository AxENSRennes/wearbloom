# App Store submission readiness

Reviewed against Apple's App Review Guidelines and App Store Connect guidance on July 21, 2026. This is an engineering and submission checklist, not legal advice.

Official sources:

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Avoiding common App Review issues](https://developer.apple.com/app-store/review/)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Auto-renewable subscriptions](https://developer.apple.com/app-store/subscriptions/)
- [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions)

## Implemented in the app

- The core app works without a required login; Sign in with Apple is optional.
- Account deletion is clearly labeled in Profile & Settings and deletes local and server data.
- Deletion warns that App Store billing is separate and links directly to subscription management.
- Sign in with Apple authorization tokens are revoked server-side before a linked account is deleted.
- Third-party AI processing is blocked until the user explicitly permits sharing selected photos with OpenAI. Permission can be withdrawn in Settings.
- Analytics and diagnostics are off by default, exclude photo content, and can be enabled or withdrawn in Settings.
- Camera/photo purpose strings, an app privacy manifest, privacy/terms/support links, purchase restoration, and a direct subscription-management link are present.
- The paywall is dismissible and has a fixed disclosure of ongoing value, automatic renewal, restore, privacy, and terms. RevenueCat supplies localized prices and periods.
- The app disclaims that generated previews are style inspiration rather than exact fit or sizing predictions.
- Uploaded photos and results are private; the app has no public feed, chat, or broad distribution of user-generated content.

## Release blockers outside the repository

Do not submit until every item below is complete.

- Replace `REVENUECAT_API_KEY` in `Configuration/Release.xcconfig` with the production public Apple SDK key. The Release app intentionally fails fast with the placeholder.
- PostHog is configured for the EU project with its current default analytics retention of up to 84 months, as disclosed in the privacy policy. Finish configuring Sentry and ensure its crash and diagnostic retention does not exceed the separately disclosed 12-month limit. If Sentry will not ship, leave its DSN unset and remove its diagnostics disclosure before submission.
- Confirm production and offsite backup pruning runs successfully and does not exceed the 8-day maximum disclosed in the privacy policy.
- Deploy `web/public` and verify that each URL returns `200`, meaningful HTML, and a valid TLS certificate in a logged-out browser:
  - `https://wearbloom.app/privacy.html`
  - `https://wearbloom.app/terms.html`
  - `https://wearbloom.app/support.html`
- The live domain returned empty `204` responses during the July 21 audit. Fix and redeploy it before review.
- Keep the production API and worker online throughout review. Verify `/health` reports both API and worker healthy and complete the production smoke checks in `docs/operations.md`.
- Verify the production Apple key, bundle ID, App Attest environment, Sign in with Apple capability, private relay configuration, and token exchange/revocation flow on a physical device.
- Complete the Paid Applications Agreement, banking, tax, and all required developer contact information.

## Subscriptions and paywall

- Create one subscription group with `monthly` and `yearly`; attach both to the RevenueCat `pro` entitlement and `default` offering.
- Complete localization, duration, price, review screenshot, and review notes for both products, then add both products to the app version submission.
- Confirm the RevenueCat paywall visibly shows each plan's localized price and period before purchase. Do not use hard-coded prices in screenshots or text.
- Confirm the promised allowance is accurate in production: WearBloom Pro currently says “up to 20 AI outfit previews each month.” If `PAID_MONTHLY_ALLOWANCE` changes, update the paywall copy, metadata, terms, and review notes together.
- Test purchase, pending Ask to Buy, restore, expiration, billing retry, cancellation, reinstall, account linking, and deletion with an active subscription.
- Configure App Store Server Notifications through RevenueCat and verify signed/idempotent webhook handling.

## App Store Connect privacy answers

Answer for the production build and all included third-party SDKs. Based on the current implementation, disclose at least:

| Data type | Linked | Tracking | Purpose |
| --- | --- | --- | --- |
| Photos or Videos | Yes | No | App Functionality |
| Email Address | Yes | No | App Functionality (optional Sign in with Apple) |
| User ID | Yes | No | App Functionality |
| Device ID | Yes | No | App Functionality / fraud prevention (App Attest) |
| Purchase History | Yes | No | App Functionality (entitlement and allowance) |
| Product Interaction | No | No | Analytics, only with opt-in |
| Crash, Performance, Other Diagnostic Data | No | No | App Functionality, only with opt-in |

Set the Privacy Policy URL to `https://wearbloom.app/privacy.html` and the optional User Privacy Choices URL to the same page. Reconcile these answers against Xcode's generated privacy report for the final archive.

## Metadata and age rating

- Screenshots and description must show the real shipping app, label AI-generated previews accurately, and avoid exact-fit claims.
- Use Lifestyle as the primary category unless the product positioning changes.
- The app has no broad UGC distribution, social media, chat, unrestricted web browsing, ads, gambling, medical advice, or explicit content. Answer the questionnaire accordingly.
- Because the service processes personal photos and the privacy policy says it is not directed to children under 13, use the age-rating override to 13+ if App Store Connect otherwise calculates a younger rating.
- Complete export-compliance questions for standard Apple networking only; do not claim custom encryption unless the implementation changes.
- Confirm the support URL, marketing URL, copyright, contact details, and privacy URL are final and contain no placeholder or “coming soon” content.

## Suggested App Review notes

> WearBloom works without login. On first launch, complete or skip onboarding; the app includes sample garments and a sample reference image. Open Create, choose at least one garment, and tap Create preview. Before the first production AI request, WearBloom explains that selected reference and garment photos are sent to WearBloom's private server and OpenAI, and asks for explicit consent. The user may decline and continue using local closet/look features. Two free generations are available on a fresh reviewer installation. WearBloom Pro is available from Profile & Settings > View plans; restore and direct App Store subscription management are on the same screen. Sign in with Apple is optional and appears in Profile & Settings. Account deletion is Profile & Settings > Privacy > Delete account and data; linked Apple tokens are revoked and server/local data are deleted. Optional analytics and diagnostics are off by default. No demo credentials are required.

Add the following only after verifying it is true for the submitted build:

> The production API and worker are online for review, the `monthly` and `yearly` in-app purchases are attached to this submission, and the reviewer account/device has two free AI previews.

## Final test pass

- Test a clean install and upgrade on the oldest supported iPhone and the latest iOS release.
- Test denied camera, photo-add, and notification permissions; offline launch; slow network; server error; AI safety refusal; and background/foreground during a render.
- Confirm no crash, placeholder key, empty screen, raw backend error, or indefinite spinner appears.
- Verify VoiceOver labels, Dynamic Type, contrast, tap targets, and all localized strings on every purchase, consent, and deletion screen.
- Archive the exact Release build, inspect its privacy report, validate it in Organizer, upload it, and run the full flow through TestFlight before submitting.
