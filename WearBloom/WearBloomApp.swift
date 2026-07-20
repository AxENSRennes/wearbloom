import SwiftUI

@main
@MainActor
struct WearBloomApp: App {
    @State private var subscriptions: SubscriptionManager

    init() {
        RevenueCatBootstrap.configure()
        _subscriptions = State(initialValue: SubscriptionManager())
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(subscriptions)
                .task {
                    await subscriptions.start()
                }
        }
    }
}

