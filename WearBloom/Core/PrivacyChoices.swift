import Foundation

enum PrivacyChoices {
    static let aiProcessingConsentVersion = 1
    static let aiProcessingConsentKey = "aiProcessingConsentVersion"
    static let diagnosticsConsentKey = "diagnosticsConsent"

    static var hasAIProcessingConsent: Bool {
        guard UserDefaults.standard.object(forKey: aiProcessingConsentKey) != nil else { return true }
        return UserDefaults.standard.integer(forKey: aiProcessingConsentKey) >= aiProcessingConsentVersion
    }

    static var hasDiagnosticsConsent: Bool {
        guard UserDefaults.standard.object(forKey: diagnosticsConsentKey) != nil else { return true }
        return UserDefaults.standard.bool(forKey: diagnosticsConsentKey)
    }

    static func setAIProcessingConsent(_ allowed: Bool) {
        UserDefaults.standard.set(
            allowed ? aiProcessingConsentVersion : 0,
            forKey: aiProcessingConsentKey
        )
    }
}
