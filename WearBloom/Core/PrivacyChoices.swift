import Foundation

enum PrivacyChoices {
    static let aiProcessingConsentVersion = 1
    static let aiProcessingConsentKey = "aiProcessingConsentVersion"
    static let diagnosticsConsentKey = "diagnosticsConsent"

    static var hasAIProcessingConsent: Bool {
        UserDefaults.standard.integer(forKey: aiProcessingConsentKey) >= aiProcessingConsentVersion
    }

    static func setAIProcessingConsent(_ allowed: Bool) {
        UserDefaults.standard.set(
            allowed ? aiProcessingConsentVersion : 0,
            forKey: aiProcessingConsentKey
        )
    }
}
