import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(SubscriptionManager.self) private var subscriptions
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase
    @Query(sort: \RenderVariant.createdAt, order: .reverse) private var variants: [RenderVariant]
    @State private var session = AppSession()
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var didSeed = false

    private var isReviewLaunch: Bool {
#if DEBUG
        ProcessInfo.processInfo.arguments.contains("-reviewTab")
#else
        false
#endif
    }

    var body: some View {
        Group {
            if hasCompletedOnboarding || isReviewLaunch {
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
        .font(BloomTypography.body)
        .preferredColorScheme(.light)
        .onAppear {
#if DEBUG
            let arguments = ProcessInfo.processInfo.arguments
            if let flag = arguments.firstIndex(of: "-reviewTab"), arguments.indices.contains(flag + 1),
               let tab = Int(arguments[flag + 1]) {
                session.selectedTab = tab
            }
#endif
        }
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
                await Telemetry.synchronizeServerPreference(userID: status.userId)
                await subscriptions.configureAccount(
                    appAccountToken: status.appAccountToken,
                    isPro: status.isPro
                )
                session.reconcilePendingRenders(variants, context: modelContext)
            } catch {
                Telemetry.error(error, context: ["operation": "account_bootstrap"])
            }
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            session.reconcilePendingRenders(variants, context: modelContext)
        }
        .sheet(isPresented: $session.isPaywallPresented) {
            WearBloomPaywallView(paidRenderAllowance: session.paidRenderAllowance)
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
        .tint(BloomColor.blue)
        .toolbarBackground(BloomColor.cream, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .overlay(alignment: .top) {
            if let toast = session.toast {
                Text(toast)
                    .font(BloomTypography.secondaryMedium)
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
