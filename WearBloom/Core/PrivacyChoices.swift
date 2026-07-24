import Foundation

enum PrivacyChoices {
    static let aiProcessingConsentVersion = 1
    static let aiProcessingConsentKey = "aiProcessingConsentVersion"
    static let diagnosticsConsentKey = "diagnosticsConsent"

    static var hasAIProcessingConsent: Bool {
        guard UserDefaults.standard.object(forKey: aiProcessingConsentKey) != nil else { return false }
        return UserDefaults.standard.integer(forKey: aiProcessingConsentKey) >= aiProcessingConsentVersion
    }

    static var hasDiagnosticsConsent: Bool {
        guard UserDefaults.standard.object(forKey: diagnosticsConsentKey) != nil else { return false }
        return UserDefaults.standard.bool(forKey: diagnosticsConsentKey)
    }

    static var hasExplicitDiagnosticsChoice: Bool {
        UserDefaults.standard.object(forKey: diagnosticsConsentKey) != nil
    }

    static func setAIProcessingConsent(_ allowed: Bool) {
        UserDefaults.standard.set(
            allowed ? aiProcessingConsentVersion : 0,
            forKey: aiProcessingConsentKey
        )
    }

    static func setDiagnosticsConsent(_ allowed: Bool) {
        UserDefaults.standard.set(allowed, forKey: diagnosticsConsentKey)
    }
}
