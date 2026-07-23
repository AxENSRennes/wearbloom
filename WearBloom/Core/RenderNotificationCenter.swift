import Foundation
import UIKit
import UserNotifications

actor RenderNotificationCenter {
    static let shared = RenderNotificationCenter()

    func notifyCompletion(lookName: String) async {
        let appIsActive = await MainActor.run { UIApplication.shared.applicationState == .active }
        guard !appIsActive else { return }
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
