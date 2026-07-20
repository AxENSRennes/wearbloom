import RevenueCatUI
import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(SubscriptionManager.self) private var subscriptions
    @Environment(\.modelContext) private var modelContext
    @State private var session = AppSession()
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var didSeed = false

    var body: some View {
        Group {
            if hasCompletedOnboarding {
                RootTabView()
                    .environment(session)
            } else {
                OnboardingView {
                    withAnimation(.smooth(duration: 0.45)) {
                        hasCompletedOnboarding = true
                    }
                }
            }
        }
        .preferredColorScheme(.light)
        .task {
            guard !didSeed else { return }
            didSeed = true
            try? session.seedIfNeeded(context: modelContext)
        }
        .task {
            guard await WearBloomAPI.shared.isConfigured else { return }
            do {
                let status = try await WearBloomAPI.shared.accountStatus()
                session.apply(status)
                await subscriptions.logIn(appUserID: status.userId)
            } catch {
                Telemetry.error(error, context: ["operation": "account_bootstrap"])
            }
        }
        .sheet(isPresented: $session.isPaywallPresented) {
            PaywallView(displayCloseButton: true)
                .onPurchaseCompleted { customerInfo in
                    subscriptions.update(customerInfo)
                    if subscriptions.isPro { session.isPaywallPresented = false }
                }
                .onRestoreCompleted { customerInfo in
                    subscriptions.update(customerInfo)
                    if subscriptions.isPro { session.isPaywallPresented = false }
                }
                .onPurchaseFailure { subscriptions.report($0) }
                .onRestoreFailure { subscriptions.report($0) }
        }
        .sheet(isPresented: $session.isProfilePresented) {
            SettingsView()
                .environment(session)
        }
        .alert(
            "Subscription error",
            isPresented: Binding(
                get: { subscriptions.errorMessage != nil },
                set: { if !$0 { subscriptions.clearError() } }
            )
        ) {
            Button("OK", role: .cancel) { subscriptions.clearError() }
        } message: {
            Text(subscriptions.errorMessage ?? String(localized: "Unknown error"))
        }
    }
}

private struct RootTabView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        @Bindable var session = session
        TabView(selection: $session.selectedTab) {
            Tab("Closet", systemImage: "tshirt", value: 0) {
                NavigationStack { ClosetView() }
            }
            Tab("Create", systemImage: "wand.and.stars", value: 1) {
                NavigationStack { CreateView() }
            }
            Tab("Looks", systemImage: "square.grid.2x2", value: 2) {
                NavigationStack { LooksView() }
            }
        }
        .tint(BloomColor.violet)
        .overlay(alignment: .top) {
            if let toast = session.toast {
                Text(toast)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .background(BloomColor.ink, in: Capsule())
                    .foregroundStyle(.white)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }
}

struct WearBloomToolbar: ToolbarContent {
    @Environment(AppSession.self) private var session

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                session.isProfilePresented = true
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(BloomColor.ink)
            }
            .accessibilityLabel("Profile and settings")
        }
    }
}
