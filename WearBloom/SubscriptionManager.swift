import Foundation
import Observation
import RevenueCat

@MainActor
@Observable
final class SubscriptionManager {
    private(set) var customerInfo: CustomerInfo?
    private(set) var currentOffering: Offering?
    private(set) var isLoading = false
    private(set) var isPurchasing = false
    private(set) var isRestoring = false
    private(set) var errorMessage: String?

    private var hasStarted = false

    var isPro: Bool {
        customerInfo?.entitlements[RevenueCatConstants.proEntitlementID]?.isActive == true
    }

    var activeProductID: String? {
        customerInfo?.entitlements[RevenueCatConstants.proEntitlementID]?.productIdentifier
    }

    var expirationDate: Date? {
        customerInfo?.entitlements[RevenueCatConstants.proEntitlementID]?.expirationDate
    }

    var willRenew: Bool {
        customerInfo?.entitlements[RevenueCatConstants.proEntitlementID]?.willRenew == true
    }

    var packages: [Package] {
        currentOffering?.availablePackages ?? []
    }

    init() {
        customerInfo = Purchases.shared.cachedCustomerInfo
    }

    /// Call from a long-lived SwiftUI `.task`. Cancellation stops the update stream.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        defer { hasStarted = false }

        await refresh()

        for await newCustomerInfo in Purchases.shared.customerInfoStream {
            customerInfo = newCustomerInfo
        }
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            customerInfo = try await Purchases.shared.customerInfo()
        } catch {
            report(error)
        }

        do {
            let offerings = try await Purchases.shared.offerings()
            guard let offering = offerings.current else {
                throw SubscriptionConfigurationError.missingCurrentOffering
            }

            let configuredProductIDs = Set(
                offering.availablePackages.map(\.storeProduct.productIdentifier)
            )
            let missingProductIDs = RevenueCatConstants.productIDs.subtracting(configuredProductIDs)
            guard missingProductIDs.isEmpty else {
                throw SubscriptionConfigurationError.missingProducts(missingProductIDs.sorted())
            }

            currentOffering = offering
        } catch {
            report(error)
        }
    }

    /// Use this for a custom product picker. RevenueCat Paywalls purchase automatically.
    func purchase(_ package: Package) async {
        guard !isPurchasing else { return }
        isPurchasing = true
        defer { isPurchasing = false }

        do {
            let result = try await Purchases.shared.purchase(package: package)
            guard !result.userCancelled else { return }

            update(result.customerInfo)
            guard isPro else {
                throw SubscriptionConfigurationError.entitlementNotUnlocked
            }
        } catch let errorCode as RevenueCat.ErrorCode
            where errorCode == .purchaseCancelledError {
            // Cancellation is an expected outcome, not an error to show.
        } catch {
            report(error)
        }
    }

    func restorePurchases() async {
        guard !isRestoring else { return }
        isRestoring = true
        defer { isRestoring = false }

        do {
            let info = try await Purchases.shared.restorePurchases()
            update(info)
            guard isPro else {
                throw SubscriptionConfigurationError.nothingToRestore
            }
        } catch {
            report(error)
        }
    }

    /// Call after the backend authenticates a user. Use a stable, non-guessable backend ID.
    func logIn(appUserID: String) async {
        do {
            let result = try await Purchases.shared.logIn(appUserID)
            update(result.customerInfo)
        } catch {
            report(error)
        }
    }

    /// Call on account sign-out only when the app should return to an anonymous RevenueCat user.
    func logOut() async {
        do {
            update(try await Purchases.shared.logOut())
        } catch {
            report(error)
        }
    }

    func update(_ info: CustomerInfo) {
        customerInfo = info
        errorMessage = nil
    }

    func report(_ error: Error) {
        errorMessage = Self.userFacingMessage(for: error)
    }

    func clearError() {
        errorMessage = nil
    }

    private static func userFacingMessage(for error: Error) -> String {
        if let configurationError = error as? SubscriptionConfigurationError {
            return configurationError.localizedDescription
        }

        let nsError = error as NSError
        let revenueCatCode = (error as? RevenueCat.ErrorCode)
            ?? RevenueCat.ErrorCode(rawValue: nsError.code)

        switch revenueCatCode {
        case .networkError, .offlineConnectionError:
            return "Check your internet connection and try again."
        case .purchaseNotAllowedError:
            return "Purchases are not allowed on this device."
        case .paymentPendingError:
            return "This purchase is pending approval. Access will unlock after approval."
        case .productNotAvailableForPurchaseError:
            return "This plan is temporarily unavailable."
        case .purchaseCancelledError:
            return "The purchase was cancelled."
        default:
            return nsError.localizedDescription
        }
    }
}

private enum SubscriptionConfigurationError: LocalizedError {
    case missingCurrentOffering
    case missingProducts([String])
    case entitlementNotUnlocked
    case nothingToRestore

    var errorDescription: String? {
        switch self {
        case .missingCurrentOffering:
            return "RevenueCat has no current offering configured."
        case let .missingProducts(productIDs):
            return "The current offering is missing: \(productIDs.joined(separator: ", "))."
        case .entitlementNotUnlocked:
            return "The purchase completed, but the pro entitlement was not unlocked. Check the RevenueCat product attachment."
        case .nothingToRestore:
            return "No WearBloom Pro purchase was found for this App Store account."
        }
    }
}
