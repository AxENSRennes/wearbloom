import XCTest

final class WearBloomUITests: XCTestCase {
    @MainActor
    func testPrimaryPersonalPreviewJourney() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "1", "-reviewSelection"]

        app.launch()

        XCTAssertTrue(app.tabBars.buttons["Closet"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Create"].exists)
        XCTAssertTrue(app.tabBars.buttons["Looks"].exists)
        XCTAssertEqual(app.tabBars.buttons.count, 3)
        XCTAssertTrue(app.staticTexts["Create"].waitForExistence(timeout: 5))

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

    @MainActor
    func testCreateMakesCompositionControlsVisibleImmediately() {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "1"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Build your outfit"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Top"].isHittable)
        XCTAssertTrue(app.buttons["Bottom"].isHittable)
        XCTAssertTrue(app.buttons["Outerwear"].isHittable)

        let incompleteAction = app.buttons["Choose your pieces"]
        XCTAssertTrue(incompleteAction.exists)
        XCTAssertFalse(incompleteAction.isEnabled)
    }

    @MainActor
    func testClosetCardsHaveEqualFramesAndDoNotOverlap() {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "0"]
        app.launch()

        let first = app.buttons["Lime car coat, Outerwear"]
        let second = app.buttons["Coral column dress, Dress"]
        let nextRow = app.buttons["Cobalt overshirt, Outerwear"]
        XCTAssertTrue(first.waitForExistence(timeout: 5))
        XCTAssertTrue(second.exists)
        XCTAssertTrue(nextRow.exists)

        XCTAssertEqual(first.frame.height, second.frame.height, accuracy: 1)
        XCTAssertLessThan(first.frame.maxY, nextRow.frame.minY)

        let categoryCarousel = app.scrollViews["closet-category-carousel"]
        XCTAssertTrue(categoryCarousel.exists)
        categoryCarousel.swipeLeft()
        XCTAssertTrue(app.buttons["Favorites"].isHittable)
    }

    @MainActor
    func testPrimaryTabsUseTheSameHeaderAction() {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "0"]
        app.launch()

        let profile = app.buttons["Profile and settings"]
        XCTAssertTrue(profile.waitForExistence(timeout: 5))
        let closetFrame = profile.frame

        app.tabBars.buttons["Looks"].tap()
        XCTAssertTrue(app.staticTexts["Looks"].waitForExistence(timeout: 5))
        XCTAssertEqual(profile.frame.width, closetFrame.width, accuracy: 1)
        XCTAssertEqual(profile.frame.height, closetFrame.height, accuracy: 1)
    }

    @MainActor
    func testPrivacyChoicesOpenTheirExplanations() {
        let app = XCUIApplication()
        app.launchArguments = ["-reviewTab", "0"]
        app.launch()

        app.buttons["Profile and settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 5))

        let aiProcessing = app.staticTexts["AI photo processing"]
        for _ in 0..<3 where !aiProcessing.exists { app.swipeUp() }
        XCTAssertTrue(aiProcessing.waitForExistence(timeout: 3))
        aiProcessing.tap()
        XCTAssertTrue(app.switches["Allow AI photo processing"].waitForExistence(timeout: 5))
        app.navigationBars.buttons["Settings"].tap()

        let diagnostics = app.staticTexts["Share diagnostics and usage"]
        for _ in 0..<3 where !diagnostics.exists { app.swipeUp() }
        XCTAssertTrue(diagnostics.waitForExistence(timeout: 3))
        diagnostics.tap()
        XCTAssertTrue(app.switches["Share diagnostics and usage"].waitForExistence(timeout: 5))
    }
}
