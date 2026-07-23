# App Store subscriptions

WearBloom uses StoreKit 2 directly in the iOS app and Apple’s official App Store
Server Library in the Bun backend. PostgreSQL is the authoritative source for
generation access. PostHog owns paywall analytics and experiments.

## App Store Connect

1. Create one auto-renewable subscription group.
2. Add products with identifiers `monthly` and `yearly`.
3. Enable Billing Grace Period for production and sandbox if WearBloom should
   continue service while Apple retries payment.
4. Under **Users and Access → Integrations → In-App Purchase**, create an
   In-App Purchase key and record its issuer ID and key ID. The `.p8` file can
   only be downloaded once.
5. Configure App Store Server Notifications V2 for both production and sandbox:
   `https://api.wearbloom.app/v1/webhooks/app-store`
6. Request a test notification and confirm the API returns HTTP 200.

## Production environment

Set these values for the API and worker in Dokploy:

| Variable | Value |
| --- | --- |
| `APPLE_APP_BUNDLE_IDENTIFIER` | `com.axel.wearbloom` |
| `APPLE_APP_ID` | Numeric Apple ID from App Store Connect |
| `APPLE_IAP_ISSUER_ID` | Issuer UUID from the In-App Purchase integration |
| `APPLE_IAP_KEY_ID` | In-App Purchase key ID |
| `APPLE_IAP_PRIVATE_KEY_BASE64` | Base64 of the downloaded `.p8` file |

The In-App Purchase key is server-only. Never add it to Xcode, an xcconfig, the
iOS bundle, or source control.

The health endpoint exposes two non-secret readiness flags:

```json
{
  "appleSubscriptions": {
    "notifications": true,
    "reconciliation": true
  }
}
```

Both must be `true` before accepting production purchases.

## State and event handling

Every purchase uses the backend-issued `appAccountToken`, and the server verifies
the Apple JWS before changing access. Notification UUIDs are stored to make
delivery idempotent. Older notifications cannot overwrite newer state.

| Apple state/event | WearBloom behavior |
| --- | --- |
| Active / initial buy / resubscribe / renewal | Pro until Apple’s expiration date |
| Auto-renew disabled | Keep Pro until expiration; mark `willRenew=false` |
| Upgrade / downgrade | Keep current access and apply Apple’s latest product/expiration |
| Billing grace period | Keep Pro until `gracePeriodExpiresDate` |
| Billing retry without grace | Remove Pro after the paid period expires |
| Billing recovery | Restore Pro using the renewed expiration |
| Expired / grace period expired | Remove Pro |
| Refund / revoke | Remove Pro immediately |
| Refund declined | Keep the status returned by Apple |
| Refund reversed | Restore only if Apple reports active or grace-period status |
| Price change / offer / renewal extension | Preserve access according to Apple’s current status and dates |
| Test / summary / metadata-only event | Record idempotently; no entitlement change |

Cancellation is not immediate revocation. Apple access remains valid through the
paid expiration date. StoreKit’s `Transaction.currentEntitlements` also includes
grace-period subscriptions and excludes refunded or revoked transactions.

## Reliability

- The app sends every verified StoreKit JWS to the backend after purchase,
  restoration, launch, and `Transaction.updates`.
- The backend verifies certificate chains against Apple’s published root
  certificates and validates bundle ID and environment.
- Notifications are the normal asynchronous update path.
- The backend calls `Get All Subscription Statuses` after device synchronization
  to reconcile the authoritative state.
- Apple retries failed production notifications. Notification History and
  `Get All Subscription Statuses` are the recovery mechanisms after an outage.
- Expensive AI generation checks PostgreSQL, never only the device’s local state.

Official references:

- [StoreKit Transaction](https://developer.apple.com/documentation/storekit/transaction)
- [App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications/app-store-server-notifications-v2)
- [App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [Apple App Store Server Library for Node](https://github.com/apple/app-store-server-library-node)
