import XCTest

final class WearBloomUITests: XCTestCase {
    @MainActor
    func testPrimaryPersonalPreviewJourney() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "1", "-reviewSelection"]

        addUIInterruptionMonitor(withDescription: "Notification permission") { alert in
            if alert.buttons["Allow"].exists {
                alert.buttons["Allow"].tap()
                return true
            }
            return false
        }

        app.launch()

        XCTAssertTrue(app.tabBars.buttons["Closet"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Create"].exists)
        XCTAssertTrue(app.tabBars.buttons["Looks"].exists)
        XCTAssertEqual(app.tabBars.buttons.count, 3)
        XCTAssertTrue(app.staticTexts["Style"].waitForExistence(timeout: 5))

        let tryOn = app.buttons["Try this outfit"]
        XCTAssertTrue(tryOn.waitForExistence(timeout: 5))
        XCTAssertTrue(tryOn.isEnabled)
        tryOn.tap()

        XCTAssertTrue(app.staticTexts["Ready to see it on you?"].waitForExistence(timeout: 5))
        app.buttons["See it on me"].tap()
        app.tap()

        XCTAssertTrue(app.staticTexts["Looks like you?"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["Helpful?"].exists)
        XCTAssertTrue(app.staticTexts["Your result stays private. It is saved or shared only when you choose one of these actions."].exists)
    }
}
