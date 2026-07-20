import Testing
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
}
