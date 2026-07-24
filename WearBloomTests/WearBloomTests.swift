import Testing
import UIKit
@testable import WearBloom

@Suite("Look composition")
@MainActor
struct LookCompositionTests {
    @Test("A dress replaces top and bottom while preserving outerwear")
    func dressReplacement() {
        let session = AppSession()
        let top = Garment(name: "Top", category: .top)
        let bottom = Garment(name: "Bottom", category: .bottom)
        let coat = Garment(name: "Coat", category: .outerwear)
        let dress = Garment(name: "Dress", category: .dress)

        session.select(top)
        session.select(bottom)
        session.select(coat)
        session.select(dress)

        #expect(session.selectedGarmentIDs[.top] == nil)
        #expect(session.selectedGarmentIDs[.bottom] == nil)
        #expect(session.selectedGarmentIDs[.dress] == dress.id)
        #expect(session.selectedGarmentIDs[.outerwear] == coat.id)
    }

    @Test("Selecting separates removes an active dress")
    func separatesReplaceDress() {
        let session = AppSession()
        let dress = Garment(name: "Dress", category: .dress)
        let top = Garment(name: "Top", category: .top)

        session.select(dress)
        session.select(top)

        #expect(session.selectedGarmentIDs[.dress] == nil)
        #expect(session.selectedGarmentIDs[.top] == top.id)
    }

    @Test("A complete look is a dress or both separates")
    func completeLookValidation() {
        let top = Garment(name: "Top", category: .top)
        let bottom = Garment(name: "Bottom", category: .bottom)
        let coat = Garment(name: "Coat", category: .outerwear)
        let dress = Garment(name: "Dress", category: .dress)

        #expect(!LookComposition.isComplete([top]))
        #expect(!LookComposition.isComplete([coat]))
        #expect(LookComposition.isComplete([top, bottom]))
        #expect(LookComposition.isComplete([top, bottom, coat]))
        #expect(LookComposition.isComplete([dress]))
        #expect(LookComposition.isComplete([dress, coat]))
        #expect(!LookComposition.isComplete([dress, top]))
        #expect(!LookComposition.isComplete([dress, Garment(name: "Second dress", category: .dress)]))
    }

    @Test("Server account status controls both current and paid allowances")
    func accountStatusControlsAllowances() {
        let session = AppSession()

        session.apply(AccountStatus(
            userId: "test-user",
            appAccountToken: UUID(),
            isPro: false,
            allowance: 3,
            paidAllowance: 24,
            used: 1,
            remaining: 2,
            periodKey: "free-lifetime"
        ))

        #expect(session.serverRendersRemaining == 2)
        #expect(session.paidRenderAllowance == 24)
    }
}

@Suite("Privacy and sharing")
struct PrivacyAndSharingTests {
    @Test("AI processing defaults off and remembers an explicit choice")
    func aiProcessingDefaultsOff() {
        let defaults = UserDefaults.standard
        let key = PrivacyChoices.aiProcessingConsentKey
        let original = defaults.object(forKey: key)
        defer {
            if let original { defaults.set(original, forKey: key) } else { defaults.removeObject(forKey: key) }
        }

        defaults.removeObject(forKey: key)
        #expect(!PrivacyChoices.hasAIProcessingConsent)
        PrivacyChoices.setAIProcessingConsent(false)
        #expect(!PrivacyChoices.hasAIProcessingConsent)
        PrivacyChoices.setAIProcessingConsent(true)
        #expect(PrivacyChoices.hasAIProcessingConsent)
    }

    @Test("Diagnostics default off and remember an explicit choice")
    func diagnosticsDefaultsOff() {
        let defaults = UserDefaults.standard
        let key = PrivacyChoices.diagnosticsConsentKey
        let original = defaults.object(forKey: key)
        defer {
            if let original { defaults.set(original, forKey: key) } else { defaults.removeObject(forKey: key) }
        }

        defaults.removeObject(forKey: key)
        #expect(!Telemetry.isCollectionEnabled)
        #expect(!PrivacyChoices.hasExplicitDiagnosticsChoice)
        defaults.set(false, forKey: key)
        #expect(!Telemetry.isCollectionEnabled)
        #expect(PrivacyChoices.hasExplicitDiagnosticsChoice)
        defaults.set(true, forKey: key)
        #expect(Telemetry.isCollectionEnabled)
    }

    @Test("Share artwork uses a vertical story canvas")
    func verticalShareArtwork() throws {
        let source = UIGraphicsImageRenderer(size: CGSize(width: 300, height: 400)).jpegData(withCompressionQuality: 0.9) {
            UIColor.systemPurple.setFill()
            $0.fill(CGRect(x: 0, y: 0, width: 300, height: 400))
        }
        let artwork = try #require(ShareImageRenderer.makeVerticalStory(resultData: source, lookName: "Evening look"))

        #expect(artwork.size == CGSize(width: 1080, height: 1920))
    }

    @Test("Unknown server messages are not shown verbatim")
    func serverMessageIsSanitized() {
        let error = APIClientError.server(code: "UNKNOWN_PROVIDER_ERROR", message: "secret provider response")

        #expect(error.errorDescription == String(localized: "Something went wrong. Please try again."))
    }

    @Test("A render variant keeps its original input snapshot")
    @MainActor
    func immutableVariantSnapshot() {
        let top = Garment(name: "Top", category: .top)
        let bottom = Garment(name: "Bottom", category: .bottom)
        let dress = Garment(name: "Dress", category: .dress)
        let look = Look(name: "First look", garments: [top, bottom])
        let variant = RenderVariant(sequence: 1, state: .ready, garmentSnapshot: "Top: Top • Bottom: Bottom", look: look)

        look.garments = [dress]

        #expect(variant.garmentSnapshot == "Top: Top • Bottom: Bottom")
        #expect(variant.look === look)
    }
}
