import Foundation
import OSLog
import PostHog
import Sentry

enum Telemetry {
    private static let logger = Logger(subsystem: "app.wearbloom", category: "product")

    static func configure() {
        if let dsn = configurationValue("SENTRY_DSN") {
            SentrySDK.start { options in
                options.dsn = dsn
                options.enableAutoSessionTracking = true
                options.tracesSampleRate = 0.2
                options.attachScreenshot = false
                options.attachViewHierarchy = false
                options.enableAppHangTracking = true
                options.sendDefaultPii = false
            }
        }

        if let key = configurationValue("POSTHOG_API_KEY"),
           let host = rawConfigurationValue("POSTHOG_HOST"),
           !host.isEmpty {
            let config = PostHogConfig(projectToken: key, host: host)
            // Product events are explicit below. Sensitive image screens are never replayed.
            config.captureScreenViews = false
            config.captureElementInteractions = false
            config.sessionReplay = false
            PostHogSDK.shared.setup(config)
        }
    }

    static func event(_ name: String, properties: [String: Any] = [:]) {
        logger.info("event=\(name, privacy: .public)")
        guard configurationValue("POSTHOG_API_KEY") != nil else { return }
        PostHogSDK.shared.capture(name, properties: properties)
    }

    static func error(_ error: Error, context: [String: String] = [:]) {
        logger.error("error=\(error.localizedDescription, privacy: .public)")
        guard configurationValue("SENTRY_DSN") != nil else { return }
        SentrySDK.configureScope { scope in
            for (key, value) in context { scope.setTag(value: value, key: key) }
        }
        SentrySDK.capture(error: error)
    }

    private static func configurationValue(_ key: String) -> String? {
        guard let value = rawConfigurationValue(key),
              !value.isEmpty,
              !value.hasPrefix("REPLACE_") else { return nil }
        return value
    }

    private static func rawConfigurationValue(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
