import SwiftData
import SwiftUI

@main
@MainActor
struct WearBloomApp: App {
    @State private var subscriptions: SubscriptionManager
    private let modelContainer: ModelContainer

    init() {
        Telemetry.configureIfAllowed()
        RevenueCatBootstrap.configure()
        _subscriptions = State(initialValue: SubscriptionManager())
        do {
            modelContainer = try ModelContainer(
                for: Garment.self,
                ReferencePhoto.self,
                Look.self,
                RenderVariant.self
            )
        } catch {
            fatalError("Unable to open the WearBloom library: \(error.localizedDescription)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(subscriptions)
                .modelContainer(modelContainer)
                .task {
                    await subscriptions.start()
                }
        }
    }
}
