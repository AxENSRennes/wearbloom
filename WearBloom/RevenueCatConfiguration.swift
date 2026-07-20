import Foundation
import RevenueCat

enum RevenueCatConstants {
    /// Dashboard display name: "WearBloom Pro". Code always uses this identifier.
    static let proEntitlementID = "pro"
    static let productIDs: Set<String> = ["lifetime", "yearly", "monthly"]
}

enum RevenueCatBootstrap {
    static func configure() {
        guard !Purchases.isConfigured else { return }

        guard
            let apiKey = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String,
            !apiKey.isEmpty,
            !apiKey.hasPrefix("REPLACE_WITH_")
        else {
            fatalError("Set REVENUECAT_API_KEY in the active xcconfig file.")
        }

        #if DEBUG
        Purchases.logLevel = .debug
        #else
        precondition(
            !apiKey.hasPrefix("test_"),
            "A RevenueCat Test Store key must never ship in an App Store build."
        )
        Purchases.logLevel = .warn
        #endif

        let configuration = Configuration.builder(withAPIKey: apiKey)
            .with(entitlementVerificationMode: .informational)
            .build()

        Purchases.configure(with: configuration)
    }
}

