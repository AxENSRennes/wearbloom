import Foundation
import UserNotifications

actor RenderNotificationCenter {
    static let shared = RenderNotificationCenter()

    func requestPermission() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .notDetermined else { return }
        _ = try? await center.requestAuthorization(options: [.alert, .sound])
    }

    func notifyCompletion(lookName: String) async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Your look is ready")
        content.body = String(localized: "\(lookName) is waiting in Looks.")
        content.sound = .default
        content.userInfo = ["destination": "looks"]
        let request = UNNotificationRequest(
            identifier: "render-\(UUID().uuidString)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }
}
