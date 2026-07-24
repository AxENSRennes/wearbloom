import Foundation
import OSLog
import PostHog
import Sentry

enum Telemetry {
    private static let logger = Logger(subsystem: "app.wearbloom", category: "product")

    static var isCollectionEnabled: Bool {
        PrivacyChoices.hasDiagnosticsConsent
    }

    static func configureIfAllowed() {
        guard isCollectionEnabled else { return }

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
            config.captureApplicationLifecycleEvents = true
            config.captureScreenViews = false
            config.captureElementInteractions = false
            config.sessionReplay = false
            PostHogSDK.shared.setup(config)
            PostHogSDK.shared.optIn()
        }
    }

    static func setCollectionEnabled(_ enabled: Bool, syncWithServer: Bool = true) {
        PrivacyChoices.setDiagnosticsConsent(enabled)
        if enabled {
            configureIfAllowed()
        } else {
            PostHogSDK.shared.optOut()
            PostHogSDK.shared.reset()
            PostHogSDK.shared.close()
            SentrySDK.close()
        }
        guard syncWithServer else { return }
        Task {
            do {
                _ = try await WearBloomAPI.shared.updatePrivacyPreferences(telemetryEnabled: enabled)
            } catch {
                logger.error("Unable to synchronize telemetry preference")
            }
        }
    }

    static func synchronizeServerPreference(userID: String) async {
        do {
            if PrivacyChoices.hasExplicitDiagnosticsChoice {
                _ = try await WearBloomAPI.shared.updatePrivacyPreferences(
                    telemetryEnabled: PrivacyChoices.hasDiagnosticsConsent
                )
            } else {
                let preference = try await WearBloomAPI.shared.privacyPreferences()
                setCollectionEnabled(preference.combinedTelemetryEnabled, syncWithServer: false)
            }
        } catch {
            setCollectionEnabled(false, syncWithServer: false)
            logger.error("Unable to load telemetry preference; collection remains disabled")
        }
        identify(userID: userID)
    }

    static func event(_ name: String, properties: [String: Any] = [:]) {
        logger.info("event=\(name, privacy: .public)")
        guard isCollectionEnabled, configurationValue("POSTHOG_API_KEY") != nil else { return }
        PostHogSDK.shared.capture(name, properties: properties)
    }

    static func identify(userID: String) {
        guard isCollectionEnabled else { return }
        if configurationValue("POSTHOG_API_KEY") != nil {
            PostHogSDK.shared.identify(userID)
        }
        if configurationValue("SENTRY_DSN") != nil {
            SentrySDK.setUser(User(userId: userID))
        }
    }

    static func resetIdentity() {
        guard isCollectionEnabled else { return }
        if configurationValue("POSTHOG_API_KEY") != nil {
            PostHogSDK.shared.reset()
        }
        if configurationValue("SENTRY_DSN") != nil {
            SentrySDK.setUser(nil)
        }
    }

    static func error(_ error: Error, context: [String: String] = [:]) {
        logger.error("error=\(error.localizedDescription, privacy: .public)")
        guard isCollectionEnabled, configurationValue("SENTRY_DSN") != nil else { return }
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
