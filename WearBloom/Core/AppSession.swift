import Foundation
import Observation
import SwiftData
import SwiftUI
import UIKit

@MainActor
@Observable
final class AppSession {
    var selectedTab = 1
    var selectedGarmentIDs: [GarmentCategory: UUID] = [:]
    var selectedReferenceID: UUID?
    var activeLookID: UUID?
    var renderingVariantID: UUID?
    var renderProgress = 0.0
    var renderMessage = String(localized: "Preparing your pieces…")
    var resultVariantID: UUID?
    var isProfilePresented = false
    var isPaywallPresented = false
    var toast: String?
    var hasLinkedAppleAccount = UserDefaults.standard.bool(forKey: "hasLinkedAppleAccount")
    var hasAIProcessingConsent = PrivacyChoices.hasAIProcessingConsent
    var serverRendersRemaining: Int?
    var paidRenderAllowance = 20
    private var reconcilingVariantIDs: Set<UUID> = []

    private(set) var freeRendersUsed: Int {
        get { UserDefaults.standard.integer(forKey: "freeRendersUsed") }
        set { UserDefaults.standard.set(newValue, forKey: "freeRendersUsed") }
    }

    var freeRendersRemaining: Int { serverRendersRemaining ?? max(0, 2 - freeRendersUsed) }

    func apply(_ status: AccountStatus) {
        serverRendersRemaining = status.remaining
        paidRenderAllowance = status.paidAllowance
    }

    func garment(for category: GarmentCategory, in garments: [Garment]) -> Garment? {
        guard let id = selectedGarmentIDs[category] else { return nil }
        return garments.first { $0.id == id }
    }

    func select(_ garment: Garment) {
        if garment.category == .dress {
            selectedGarmentIDs[.top] = nil
            selectedGarmentIDs[.bottom] = nil
        } else if garment.category == .top || garment.category == .bottom {
            selectedGarmentIDs[.dress] = nil
        }
        selectedGarmentIDs[garment.category] = garment.id
        Telemetry.event("garment_selected", properties: ["category": garment.category.rawValue])
    }

    func remove(category: GarmentCategory) {
        selectedGarmentIDs[category] = nil
    }

    func resetDraft() {
        selectedGarmentIDs = [:]
        activeLookID = nil
        resultVariantID = nil
        renderingVariantID = nil
    }

    func resetAfterAccountDeletion() {
        resetDraft()
        selectedReferenceID = nil
        serverRendersRemaining = nil
        paidRenderAllowance = 20
        freeRendersUsed = 0
        setAIProcessingConsent(false)
        hasLinkedAppleAccount = false
        UserDefaults.standard.removeObject(forKey: "hasLinkedAppleAccount")
    }

    func setAIProcessingConsent(_ allowed: Bool) {
        PrivacyChoices.setAIProcessingConsent(allowed)
        hasAIProcessingConsent = allowed
    }

    func load(_ look: Look) {
        activeLookID = look.id
        selectedGarmentIDs = Dictionary(uniqueKeysWithValues: look.garments.map { ($0.category, $0.id) })
        selectedTab = 1
        Telemetry.event("look_edit_started", properties: ["piece_count": look.garments.count, "variant_count": look.variants.count])
    }

    func seedIfNeeded(context: ModelContext) throws {
#if !DEBUG
        // Production libraries always start from the user's own wardrobe.
        return
#else
        var garmentDescriptor = FetchDescriptor<Garment>()
        garmentDescriptor.fetchLimit = 1
        if try context.fetch(garmentDescriptor).isEmpty {
            let samples: [(String, GarmentCategory, String, String, String?)] = [
                ("Plum gathered top", .top, "#7C3558", "tshirt.fill", "plum-blouse.png"),
                ("Orchid knit top", .top, "#BEB2D8", "tshirt.fill", "orchid-knit.png"),
                ("Black wide-leg trousers", .bottom, "#252525", "figure.stand.dress.line.vertical.figure", "black-trousers.jpg"),
                ("Cobalt overshirt", .outerwear, "#3038F2", "jacket.fill", "cobalt-overshirt.png"),
                ("Coral column dress", .dress, "#FF6D5B", "figure.dress.line.vertical.figure", "coral-dress.png"),
                ("Lime car coat", .outerwear, "#D9FF43", "jacket.fill", "lime-coat.png")
            ]
            var seededGarments: [Garment] = []
            for (name, category, hex, symbol, assetName) in samples {
                let photoData = assetName.flatMap(PreviewImageFactory.bundledData(named:))
                let garment = Garment(
                    name: name,
                    category: category,
                    imageData: photoData ?? PreviewImageFactory.garmentPoster(color: UIColor(Color(hex: hex)), symbol: symbol),
                    colorHex: hex
                )
                context.insert(garment)
                seededGarments.append(garment)
            }

            if let top = seededGarments.first(where: { $0.category == .top }),
               let bottom = seededGarments.first(where: { $0.category == .bottom }) {
                let look = Look(name: String(localized: "Easy contrast"), isFavorite: true, garments: [top, bottom])
                let variant = RenderVariant(
                    sequence: 1,
                    state: .ready,
                    resultData: PreviewImageFactory.bundledData(named: "model-result.jpg"),
                    garmentSnapshot: "Top: \(top.name) • Bottom: \(bottom.name)",
                    completedAt: .now,
                    look: look
                )
                look.variants.append(variant)
                context.insert(look)
                context.insert(variant)
            }
        }

        var photoDescriptor = FetchDescriptor<ReferencePhoto>()
        photoDescriptor.fetchLimit = 1
        if try context.fetch(photoDescriptor).isEmpty {
            context.insert(ReferencePhoto(
                name: String(localized: "Editorial sample"),
                imageData: PreviewImageFactory.bundledData(named: "model-create.jpg") ?? PreviewImageFactory.referencePoster(),
                isDefault: true
            ))
        }
        try context.save()

#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-reviewSelection") {
            let allGarments = try context.fetch(FetchDescriptor<Garment>())
            if let top = allGarments.first(where: { $0.category == .top }) { select(top) }
            if let bottom = allGarments.first(where: { $0.category == .bottom }) { select(bottom) }
        }
#endif
#endif
    }

    func beginRender(
        garments: [Garment],
        references: [ReferencePhoto],
        looks: [Look],
        context: ModelContext,
        isPro: Bool
    ) async {
        guard renderingVariantID == nil else { return }
        let remoteConfigured = await WearBloomAPI.shared.isConfigured
        guard !remoteConfigured || (serverRendersRemaining ?? 1) > 0 else {
            isPaywallPresented = true
            return
        }
        let selected = garments.filter { selectedGarmentIDs.values.contains($0.id) }
        guard LookComposition.isComplete(selected) else {
            showToast(String(localized: "Choose a dress or both a top and bottom first."))
            return
        }
        let reference = references.first { $0.id == selectedReferenceID }
            ?? references.first(where: \ReferencePhoto.isDefault)
            ?? references.first
        guard let reference else {
            showToast(String(localized: "Add a reference photo first."))
            return
        }

        let look: Look
        if let activeLookID, let existing = looks.first(where: { $0.id == activeLookID }) {
            look = existing
            look.garments = selected
            look.updatedAt = .now
        } else {
            look = Look(name: String(localized: "Look \(looks.count + 1)"), garments: selected)
            context.insert(look)
            activeLookID = look.id
        }
        let variant = RenderVariant(
            sequence: look.variants.count + 1,
            state: .queued,
            garmentSnapshot: selected.map { "\($0.category.title): \($0.name)" }.joined(separator: " • "),
            look: look
        )
        if remoteConfigured {
            variant.remoteRenderID = variant.id
            variant.isPreviewSimulation = false
        }
        context.insert(variant)
        look.variants.append(variant)
        guard context.saveReporting(operation: "render_queue_save") else {
            context.rollback()
            showToast(String(localized: "Couldn’t start this preview. Please try again."))
            return
        }

        renderingVariantID = variant.id
        Telemetry.event("render_started", properties: [
            "piece_count": selected.count,
            "is_pro": isPro,
            "mode": remoteConfigured ? "remote" : "on_device_preview"
        ])
        renderProgress = 0.08
        variant.state = .rendering

        let remoteTask: Task<RemoteRenderResult, Error>?
        if remoteConfigured {
            guard let referenceData = reference.imageData else {
                variant.state = .failed
                renderingVariantID = nil
                showToast(String(localized: "The reference photo could not be read."))
                return
            }
            let remoteInput = RemoteLookInput(
                id: look.id,
                renderID: variant.id,
                name: look.name,
                garments: selected.compactMap { garment in
                    guard let imageData = garment.imageData else { return nil }
                    return RemoteGarmentInput(
                        id: garment.id,
                        name: garment.name,
                        category: garment.category,
                        imageData: garment.originalImageData ?? imageData,
                        remoteAssetID: garment.remoteAssetID
                    )
                },
                reference: RemoteReferenceInput(
                    id: reference.id,
                    imageData: referenceData,
                    remoteAssetID: reference.remoteAssetID,
                    isGenerated: reference.isGeneratedReference,
                    generatedFromVariantID: reference.generatedFromVariantID
                )
            )
            remoteTask = Task { try await WearBloomAPI.shared.render(remoteInput) }
        } else {
            remoteTask = nil
        }

        let phases: [(Double, String, UInt64)] = [
            (0.22, String(localized: "Reading the silhouette…"), 650_000_000),
            (0.46, String(localized: "Composing color and shape…"), 800_000_000),
            (0.72, String(localized: "Bringing the look together…"), 850_000_000),
            (0.91, String(localized: "Finishing the details…"), 650_000_000)
        ]
        for phase in phases {
            guard !Task.isCancelled else { return }
            try? await Task.sleep(nanoseconds: phase.2)
            withAnimation(.smooth(duration: 0.6)) {
                renderProgress = phase.0
                renderMessage = phase.1
            }
        }

        if let remoteTask {
            renderMessage = String(localized: "Rendering your personal preview…")
            renderProgress = 0.94
            do {
                let result = try await remoteTask.value
                variant.resultData = result.data
                variant.isPreviewSimulation = false
                variant.remoteRenderID = result.renderID
                reference.remoteAssetID = result.referenceAsset
                for garment in selected { garment.remoteAssetID = result.garmentAssets[garment.id] }
                if !isPro { freeRendersUsed += 1 }
                if let serverRendersRemaining { self.serverRendersRemaining = max(0, serverRendersRemaining - 1) }
            } catch {
                if case APIClientError.timedOut = error {
                    variant.state = .rendering
                    renderingVariantID = nil
                    renderProgress = 0
                    context.saveReporting(operation: "render_background_state_save")
                    Telemetry.event("render_continuing_in_background")
                    showToast(error.localizedDescription)
                    return
                }
                variant.state = .failed
                variant.completedAt = .now
                renderingVariantID = nil
                renderProgress = 0
                context.saveReporting(operation: "render_failure_save")
                Telemetry.error(error, context: ["operation": "render"])
                Telemetry.event("render_failed", properties: ["mode": "remote"])
                if case let APIClientError.server(code, _) = error, code == "QUOTA_EXHAUSTED" {
                    serverRendersRemaining = 0
                    isPaywallPresented = true
                } else {
                    showToast(error.localizedDescription)
                }
                return
            }
        } else {
            variant.resultData = PreviewImageFactory.compose(referenceData: reference.imageData, garments: selected)
            variant.isPreviewSimulation = true
        }
        variant.state = .ready
        variant.completedAt = .now
        context.saveReporting(operation: "render_success_save")
        withAnimation(.smooth) { renderProgress = 1 }
        renderingVariantID = nil
        resultVariantID = variant.id
        Telemetry.event("render_succeeded", properties: [
            "piece_count": selected.count,
            "mode": variant.isPreviewSimulation ? "on_device_preview" : "remote"
        ])
        await RenderNotificationCenter.shared.notifyCompletion(lookName: look.name)
    }

    func reconcilePendingRenders(_ variants: [RenderVariant], context: ModelContext) {
        for variant in variants where variant.state == .queued || variant.state == .rendering {
            guard let remoteID = variant.remoteRenderID,
                  !reconcilingVariantIDs.contains(variant.id) else { continue }
            reconcilingVariantIDs.insert(variant.id)
            Task { @MainActor in
                defer { reconcilingVariantIDs.remove(variant.id) }
                do {
                    let data = try await WearBloomAPI.shared.waitForRender(remoteID)
                    variant.resultData = data
                    variant.state = .ready
                    variant.isPreviewSimulation = false
                    variant.completedAt = .now
                    context.saveReporting(operation: "render_reconcile_success_save")
                    resultVariantID = variant.id
                    if let name = variant.look?.name {
                        await RenderNotificationCenter.shared.notifyCompletion(lookName: name)
                    }
                    Telemetry.event("render_recovered_after_resume")
                    do {
                        apply(try await WearBloomAPI.shared.accountStatus())
                    } catch {
                        Telemetry.error(error, context: ["operation": "account_status_refresh"])
                    }
                } catch APIClientError.timedOut {
                    // The server still owns the job. It will be checked again on the next app activation.
                } catch {
                    variant.state = .failed
                    variant.completedAt = .now
                    context.saveReporting(operation: "render_reconcile_failure_save")
                    Telemetry.error(error, context: ["operation": "render_reconcile"])
                }
            }
        }
    }

    func showToast(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(for: .seconds(2.4))
            if toast == message { toast = nil }
        }
    }

}
