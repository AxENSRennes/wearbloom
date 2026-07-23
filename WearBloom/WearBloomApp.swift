import SwiftData
import SwiftUI
import UIKit
import UserNotifications

final class WearBloomAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await RemoteLibraryCoordinator.shared.registerPushToken(token) }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}

@main
@MainActor
struct WearBloomApp: App {
    @UIApplicationDelegateAdaptor(WearBloomAppDelegate.self) private var appDelegate
    @State private var subscriptions: SubscriptionManager
    private let modelContainer: ModelContainer

    init() {
        BloomTypography.configureUIKitAppearance()
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
