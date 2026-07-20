import RevenueCatUI
import SwiftUI

struct ContentView: View {
    @Environment(SubscriptionManager.self) private var subscriptions

    @State private var isPaywallPresented = false
    @State private var isCustomerCenterPresented = false

    var body: some View {
        NavigationStack {
            List {
                Section("WearBloom Pro") {
                    LabeledContent("Access", value: subscriptions.isPro ? "Active" : "Free")

                    if let productID = subscriptions.activeProductID {
                        LabeledContent("Product", value: productID)
                    }

                    if let expirationDate = subscriptions.expirationDate {
                        LabeledContent(
                            subscriptions.willRenew ? "Renews" : "Expires",
                            value: expirationDate.formatted(date: .abbreviated, time: .omitted)
                        )
                    }

                    if subscriptions.isPro {
                        Label("Pro generation features are unlocked", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    } else {
                        Button("View plans") {
                            isPaywallPresented = true
                        }
                    }
                }

                Section("Purchases") {
                    Button("Restore purchases") {
                        Task { await subscriptions.restorePurchases() }
                    }
                    .disabled(subscriptions.isRestoring)

                    Button("Manage subscription and support") {
                        isCustomerCenterPresented = true
                    }
                }
            }
            .navigationTitle("WearBloom")
            .refreshable {
                await subscriptions.refresh()
            }
            .overlay {
                if subscriptions.isLoading {
                    ProgressView()
                }
            }
            .sheet(isPresented: $isPaywallPresented) {
                PaywallView(displayCloseButton: true)
                    .onPurchaseCompleted { customerInfo in
                        subscriptions.update(customerInfo)
                        if subscriptions.isPro {
                            isPaywallPresented = false
                        }
                    }
                    .onRestoreCompleted { customerInfo in
                        subscriptions.update(customerInfo)
                        if subscriptions.isPro {
                            isPaywallPresented = false
                        }
                    }
                    .onPurchaseFailure { error in
                        subscriptions.report(error)
                    }
                    .onRestoreFailure { error in
                        subscriptions.report(error)
                    }
            }
            .sheet(isPresented: $isCustomerCenterPresented) {
                CustomerCenterView()
                    .onCustomerCenterRestoreCompleted { customerInfo in
                        subscriptions.update(customerInfo)
                    }
                    .onCustomerCenterRestoreFailed { error in
                        subscriptions.report(error)
                    }
            }
            .alert(
                "Subscription error",
                isPresented: Binding(
                    get: { subscriptions.errorMessage != nil },
                    set: { isPresented in
                        if !isPresented { subscriptions.clearError() }
                    }
                )
            ) {
                Button("OK", role: .cancel) {
                    subscriptions.clearError()
                }
            } message: {
                Text(subscriptions.errorMessage ?? "Unknown error")
            }
        }
    }
}
