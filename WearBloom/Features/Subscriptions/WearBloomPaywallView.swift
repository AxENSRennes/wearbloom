import StoreKit
import SwiftUI

struct WearBloomPaywallView: View {
    @Environment(SubscriptionManager.self) private var subscriptions
    @Environment(\.dismiss) private var dismiss
    let paidRenderAllowance: Int

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 42, weight: .semibold))
                        .foregroundStyle(BloomColor.violet)
                        .frame(width: 84, height: 84)
                        .background(BloomColor.lime, in: Circle())

                    VStack(spacing: 8) {
                        Text("WearBloom Pro")
                            .font(BloomTypography.modalTitle)
                        Text("Create up to \(paidRenderAllowance) private AI outfit previews every month.")
                            .font(BloomTypography.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    VStack(spacing: 12) {
                        benefit("Preview complete outfits before getting dressed", icon: "wand.and.stars")
                        benefit("Use your own closet and reference photos", icon: "lock.fill")
                        benefit("Keep every saved look private", icon: "photo.on.rectangle")
                    }

                    if subscriptions.isLoading {
                        ProgressView("Loading App Store plans…")
                    } else {
                        ForEach(subscriptions.products, id: \.id) { product in
                            Button {
                                Task {
                                    await subscriptions.purchase(product)
                                    if subscriptions.isPro { dismiss() }
                                }
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(product.id == AppStoreProducts.yearly ? "Yearly" : "Monthly")
                                            .font(BloomTypography.secondaryMedium)
                                        Text(periodDescription(product))
                                            .font(BloomTypography.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(product.displayPrice)
                                        .font(BloomTypography.heading)
                                }
                                .padding(16)
                                .background(.white, in: RoundedRectangle(cornerRadius: 18))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 18)
                                        .stroke(BloomColor.violet.opacity(0.25))
                                }
                            }
                            .buttonStyle(.plain)
                            .disabled(subscriptions.isPurchasing)
                        }
                    }

                    if subscriptions.isPurchasing { ProgressView() }

                    Button("Restore purchases") {
                        Task {
                            await subscriptions.restorePurchases()
                            if subscriptions.isPro { dismiss() }
                        }
                    }
                    .disabled(subscriptions.isRestoring)

                    Text("Payment is charged to your Apple Account. Plans renew automatically unless canceled at least 24 hours before the end of the current period.")
                        .font(BloomTypography.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    HStack(spacing: 20) {
                        Link("Privacy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
                        Link("Terms", destination: URL(string: "https://wearbloom.app/terms.html")!)
                        Link("Manage", destination: URL(string: "https://apps.apple.com/account/subscriptions")!)
                    }
                    .font(BloomTypography.captionMedium)
                }
                .padding(24)
            }
            .background(BloomColor.cream)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear {
                Telemetry.event("paywall_viewed", properties: ["source": "custom_storekit"])
            }
        }
    }

    private func benefit(_ title: LocalizedStringKey, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundStyle(BloomColor.violet)
            Text(title)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func periodDescription(_ product: Product) -> String {
        guard let period = product.subscription?.subscriptionPeriod else { return product.displayName }
        let unit: String
        switch period.unit {
        case .day: unit = period.value == 1 ? "day" : "days"
        case .week: unit = period.value == 1 ? "week" : "weeks"
        case .month: unit = period.value == 1 ? "month" : "months"
        case .year: unit = period.value == 1 ? "year" : "years"
        @unknown default: return product.displayName
        }
        return "\(product.displayPrice) every \(period.value) \(unit)"
    }
}
