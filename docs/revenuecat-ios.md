# RevenueCat iOS setup

The Xcode project already contains the `RevenueCat` and `RevenueCatUI` Swift Package products from:

`https://github.com/RevenueCat/purchases-ios-spm.git`

The dependency rule is `5.74.0 ..< 6.0.0`; `Package.resolved` currently pins `5.81.1`. The app uses Swift concurrency, `customerInfoStream`, RevenueCat Paywalls, and Customer Center.

## 1. Important identifiers

Use these values exactly and keep display names separate from code identifiers:

| Kind | Identifier | Suggested display name |
| --- | --- | --- |
| Entitlement | `pro` | WearBloom Pro |
| Product | `yearly` | Yearly |
| Product | `monthly` | Monthly |
| Offering | `default` | Default |

The entitlement check in Swift is therefore:

```swift
customerInfo.entitlements["pro"]?.isActive == true
```

Do not check `"WearBloom Pro"`; that is a user-facing name, not the stable identifier.

## 2. Configure RevenueCat Test Store

The supplied `test_...` key is a RevenueCat Test Store public SDK key. It does not read products from App Store Connect.

1. In RevenueCat, open **Product catalog → Products**.
2. Add Test Store products named `yearly` and `monthly`.
3. Configure `yearly` as an annual subscription and `monthly` as a monthly subscription.
4. Open **Product catalog → Entitlements** and create identifier `pro`, display name **WearBloom Pro**.
5. Attach both products to `pro`.
6. Open **Offerings**, create `default`, and mark it as the current offering.
7. Add the products using the predefined package types:
   - Annual (`$rc_annual`) → `yearly`
   - Monthly (`$rc_monthly`) → `monthly`
8. Create a RevenueCat Paywall for the `default` offering. Include purchase, restore, legal links, and a close affordance if the paywall is dismissible.

Run the app with the Debug configuration. The test key lives in `Configuration/Debug.xcconfig` and debug builds enable RevenueCat logs.

## 3. Configure real App Store products

Before shipping:

1. Accept Apple's Paid Applications Agreement and complete tax/banking details.
2. In App Store Connect, create one subscription group for WearBloom Pro.
3. Add auto-renewable subscriptions with product IDs `monthly` and `yearly` to that group.
4. Add localization, price, review screenshot, and review notes for both products.
5. In RevenueCat, add the Apple app with the production bundle ID `com.axel.wearbloom`.
6. Configure the App Store Connect shared secret / In-App Purchase key requested by RevenueCat, then import both Apple products.
7. Attach the Apple products to the same `pro` entitlement and matching offering packages.
8. Replace the placeholder in `Configuration/Release.xcconfig` with the app-specific **public Apple SDK key**.

The app deliberately crashes early if a Release build still contains the placeholder or a `test_` key. Never place a RevenueCat secret API key in an iOS app.

## 4. Runtime flow

`RevenueCatBootstrap.configure()` runs once at app startup. `SubscriptionManager` then:

- reads cached customer info immediately for fast launch;
- fetches current customer info and the current offering;
- verifies that both expected products exist in that offering;
- observes `Purchases.shared.customerInfoStream` for later updates;
- exposes `isPro`, active product, expiration date, renewal state, restore, login, logout, and manual package purchase methods;
- turns common SDK failures into user-facing error messages.

`ContentView` demonstrates a remotely configured `PaywallView`, restore handling, entitlement-gated UI, and `CustomerCenterView`.

For a hard feature gate, RevenueCat also supports this modifier:

```swift
import RevenueCatUI

ProFeatureView()
    .presentPaywallIfNeeded(requiredEntitlementIdentifier: "pro")
```

Use this only when opening a Pro-only feature. Do not automatically hard-paywall the entire app unless that is the intended onboarding model.

## 5. Customer identity

The app starts anonymously. Once the WearBloom backend authenticates a person, call:

```swift
await subscriptions.logIn(appUserID: backendUserID)
```

Use the stable, private backend UUID—not an email, display name, or hard-coded value. Call `logOut()` only when signing out should return the installation to an anonymous RevenueCat customer. Ensure RevenueCat webhook `app_user_id` values map to the same backend identity.

## 6. Customer Center

Customer Center is appropriate here because monthly/yearly subscribers need self-service cancellation, plan changes, restore, refund/support flows, and billing information. It requires a RevenueCat Pro or Enterprise plan and dashboard configuration.

Keep the explicit **Restore purchases** button even when Customer Center and the paywall provide restore actions; it is easy for users and App Review to find.

## 7. Production best practices

- Gate UI with the `pro` entitlement, never by comparing product IDs.
- Never hard-code localized prices; RevenueCat Paywalls and `Package.localizedPriceString` read StoreKit values.
- Treat cancellation as a normal outcome and payment-pending as not yet entitled.
- Refresh customer info when entering purchase-sensitive screens; SDK caching makes this safe.
- Keep expensive generation authorization server-side. The client entitlement is for responsive UI; the WearBloom API must decide whether a generation is allowed from webhook/reconciled RevenueCat state.
- Process RevenueCat webhooks idempotently and verify their authorization.
- Test new purchase, renewal, cancellation, billing issue, restore, account login/linking, and reinstall flows.
- Configure App Store Server Notifications through RevenueCat for timely subscription updates.
- Keep launch offerings to monthly and annual subscriptions; AI generation has ongoing marginal cost.

## Official references

- [Install RevenueCat for iOS](https://www.revenuecat.com/docs/getting-started/installation/ios)
- [Configure the SDK](https://www.revenuecat.com/docs/getting-started/configuring-sdk)
- [Configure products](https://www.revenuecat.com/docs/projects/configuring-products)
- [Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)
- [Offerings](https://www.revenuecat.com/docs/offerings/overview)
- [Customer info](https://www.revenuecat.com/docs/customers/customer-info)
- [RevenueCat Paywalls](https://www.revenuecat.com/docs/tools/paywalls)
- [Display Paywalls on iOS](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls)
- [Customer Center for iOS](https://www.revenuecat.com/docs/tools/customer-center/customer-center-integration-ios)
