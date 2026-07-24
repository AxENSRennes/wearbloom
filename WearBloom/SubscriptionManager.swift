import Foundation
import Observation
import StoreKit

enum AppStoreProducts {
    static let monthly = "monthly"
    static let yearly = "yearly"
    static let all: Set<String> = [monthly, yearly]
}

@MainActor
@Observable
final class SubscriptionManager {
    private(set) var products: [Product] = []
    private(set) var activeProductID: String?
    private(set) var expirationDate: Date?
    private(set) var willRenew = false
    private(set) var isLoading = false
    private(set) var isPurchasing = false
    private(set) var isRestoring = false
    private(set) var productLoadErrorMessage: String?
    private(set) var errorMessage: String?

    private var appAccountToken: UUID? = SubscriptionManager.localTestingToken()
    private var serverReportsPro = false
    private var hasStarted = false

    var isPro: Bool {
        serverReportsPro || (expirationDate.map { $0 > Date() } ?? false)
    }

    /// Call from a long-lived SwiftUI `.task`. Cancellation stops the StoreKit update stream.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true
        defer { hasStarted = false }

        await refresh()
        for await result in Transaction.updates {
            do {
                let verifiedTransaction = try verifiedTransaction(result)
                try await synchronize([verifiedTransaction])
                await refreshEntitlements()
                await verifiedTransaction.transaction.finish()
            } catch {
                report(error)
            }
        }
    }

    func configureAccount(appAccountToken: UUID, isPro: Bool) async {
        self.appAccountToken = appAccountToken
        serverReportsPro = isPro
        await refreshEntitlements()
    }

    func clearAccount() {
        appAccountToken = nil
        serverReportsPro = false
    }

    func refresh() async {
        isLoading = true
        productLoadErrorMessage = nil
        defer { isLoading = false }
        do {
            let loaded = try await Product.products(for: AppStoreProducts.all)
            products = loaded.sorted { lhs, rhs in
                if lhs.id == AppStoreProducts.monthly { return true }
                if rhs.id == AppStoreProducts.monthly { return false }
                return lhs.price < rhs.price
            }
            let missing = AppStoreProducts.all.subtracting(products.map(\.id))
            guard missing.isEmpty else {
                throw SubscriptionConfigurationError.missingProducts(missing.sorted())
            }
        } catch {
            productLoadErrorMessage = Self.userFacingMessage(for: error)
            Telemetry.error(error, context: ["operation": "app_store_product_load"])
        }
        await refreshEntitlements()
    }

    func purchase(_ product: Product) async {
        guard !isPurchasing else { return }
        guard let appAccountToken else {
            report(SubscriptionConfigurationError.accountNotReady)
            return
        }
        isPurchasing = true
        defer { isPurchasing = false }
        Telemetry.event("subscription_purchase_started", properties: ["product_id": product.id])

        do {
            switch try await product.purchase(options: [.appAccountToken(appAccountToken)]) {
            case let .success(result):
                let verifiedTransaction = try verifiedTransaction(result)
                try await synchronize([verifiedTransaction])
                await refreshEntitlements()
                await verifiedTransaction.transaction.finish()
                Telemetry.event("subscription_purchase_completed", properties: ["product_id": product.id])
            case .pending:
                errorMessage = String(localized: "This purchase is pending approval. Access will unlock after approval.")
            case .userCancelled:
                break
            @unknown default:
                throw SubscriptionConfigurationError.unknownPurchaseResult
            }
        } catch {
            report(error)
        }
    }

    func restorePurchases() async {
        guard !isRestoring else { return }
        isRestoring = true
        defer { isRestoring = false }
        do {
            try await AppStore.sync()
            await refreshEntitlements()
            guard isPro else { throw SubscriptionConfigurationError.nothingToRestore }
            Telemetry.event("subscription_restored")
        } catch {
            report(error)
        }
    }

    func report(_ error: Error) {
        errorMessage = Self.userFacingMessage(for: error)
        Telemetry.error(error, context: ["operation": "app_store_subscription"])
    }

    func clearError() {
        errorMessage = nil
    }

    private func refreshEntitlements() async {
        var activeTransactions: [VerifiedStoreTransaction] = []
        for await result in Transaction.currentEntitlements {
            do {
                let verifiedTransaction = try verifiedTransaction(result)
                let transaction = verifiedTransaction.transaction
                guard AppStoreProducts.all.contains(transaction.productID) else { continue }
                activeTransactions.append(verifiedTransaction)
            } catch {
                report(error)
            }
        }

        if !activeTransactions.isEmpty {
            do {
                try await synchronize(activeTransactions)
                serverReportsPro = true
            } catch {
                // StoreKit can still render the local state, but expensive server work stays locked
                // until the signed transactions reach the WearBloom API.
                report(error)
            }
        }

        let active = activeTransactions.max {
            ($0.transaction.expirationDate ?? .distantPast) < ($1.transaction.expirationDate ?? .distantPast)
        }
        activeProductID = active?.transaction.productID
        expirationDate = active?.transaction.expirationDate
        await refreshRenewalState(for: active?.transaction.productID)
    }

    private func refreshRenewalState(for productID: String?) async {
        willRenew = false
        guard
            let productID,
            let product = products.first(where: { $0.id == productID }),
            let statuses = try? await product.subscription?.status
        else { return }

        for status in statuses {
            guard case let .verified(transaction) = status.transaction,
                  transaction.productID == productID,
                  case let .verified(renewalInfo) = status.renewalInfo
            else { continue }
            willRenew = renewalInfo.willAutoRenew
            return
        }
    }

    private func synchronize(_ transactions: [VerifiedStoreTransaction]) async throws {
        guard appAccountToken != nil, await WearBloomAPI.shared.isConfigured else { return }
        try await WearBloomAPI.shared.syncAppleSubscription(
            signedTransactions: transactions.map(\.jwsRepresentation)
        )
        let status = try await WearBloomAPI.shared.accountStatus()
        serverReportsPro = status.isPro
    }

    private static func localTestingToken() -> UUID {
        let key = "storeKitLocalAppAccountToken"
        if let value = UserDefaults.standard.string(forKey: key), let token = UUID(uuidString: value) {
            return token
        }
        let token = UUID()
        UserDefaults.standard.set(token.uuidString, forKey: key)
        return token
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case let .verified(value):
            return value
        case let .unverified(_, error):
            throw error
        }
    }

    private func verifiedTransaction(
        _ result: VerificationResult<Transaction>
    ) throws -> VerifiedStoreTransaction {
        VerifiedStoreTransaction(
            transaction: try verified(result),
            jwsRepresentation: result.jwsRepresentation
        )
    }

    private static func userFacingMessage(for error: Error) -> String {
        if let configurationError = error as? SubscriptionConfigurationError {
            return configurationError.localizedDescription
        }
        if error is URLError {
            return String(localized: "Check your internet connection and try again.")
        }
        if let storeKitError = error as? StoreKitError {
            switch storeKitError {
            case .notAvailableInStorefront:
                return String(localized: "Purchases are not available on this device.")
            case .notEntitled:
                return String(localized: "No active WearBloom Pro purchase was found.")
            default:
                break
            }
        }
        return error.localizedDescription
    }
}

private struct VerifiedStoreTransaction {
    let transaction: Transaction
    let jwsRepresentation: String
}

private enum SubscriptionConfigurationError: LocalizedError {
    case missingProducts([String])
    case accountNotReady
    case nothingToRestore
    case unknownPurchaseResult

    var errorDescription: String? {
        switch self {
        case let .missingProducts(productIDs):
            return String(localized: "Subscription products are temporarily unavailable: \(productIDs.joined(separator: ", ")).")
        case .accountNotReady:
            return String(localized: "Your account is still loading. Try again in a moment.")
        case .nothingToRestore:
            return String(localized: "No WearBloom Pro purchase was found for this App Store account.")
        case .unknownPurchaseResult:
            return String(localized: "The App Store returned an unknown purchase result.")
        }
    }
}
