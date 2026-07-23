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
}

extension AppSession {
    func beginRender(
        garments: [Garment],
        references: [ReferencePhoto],
        looks: [Look],
        context: ModelContext,
        isPro: Bool
    ) async {
        guard let preparation = await prepareRender(
            garments: garments,
            references: references,
            looks: looks,
            context: context,
            isPro: isPro
        ) else { return }

        let remoteTask = makeRemoteTask(for: preparation)
        guard await advanceRenderProgress() else { return }
        guard await resolveRender(
            preparation,
            remoteTask: remoteTask,
            context: context,
            isPro: isPro
        ) else { return }
        await finishRender(preparation, context: context)
    }

    private func prepareRender(
        garments: [Garment],
        references: [ReferencePhoto],
        looks: [Look],
        context: ModelContext,
        isPro: Bool
    ) async -> RenderPreparation? {
        guard renderingVariantID == nil else { return nil }
        let remoteConfigured = await WearBloomAPI.shared.isConfigured
        guard !remoteConfigured || (serverRendersRemaining ?? 1) > 0 else {
            isPaywallPresented = true
            return nil
        }
        let selected = garments.filter { selectedGarmentIDs.values.contains($0.id) }
        guard LookComposition.isComplete(selected) else {
            showToast(String(localized: "Choose a dress or both a top and bottom first."))
            return nil
        }
        guard let reference = selectedReference(from: references) else {
            showToast(String(localized: "Add a reference photo first."))
            return nil
        }
        guard !remoteConfigured || reference.imageData != nil else {
            showToast(String(localized: "The reference photo could not be read."))
            return nil
        }
        let look = upsertDraftLook(selected: selected, looks: looks, context: context)
        let variant = queueVariant(for: look, selected: selected, remoteConfigured: remoteConfigured, context: context)
        guard context.saveReporting(operation: "render_queue_save") else {
            context.rollback()
            showToast(String(localized: "Couldn’t start this preview. Please try again."))
            return nil
        }
        renderingVariantID = variant.id
        renderProgress = 0.08
        variant.state = .rendering
        Telemetry.event("render_started", properties: [
            "piece_count": selected.count,
            "is_pro": isPro,
            "mode": remoteConfigured ? "remote" : "on_device_preview"
        ])
        return RenderPreparation(
            selected: selected,
            reference: reference,
            look: look,
            variant: variant,
            remoteConfigured: remoteConfigured
        )
    }

    private func selectedReference(from references: [ReferencePhoto]) -> ReferencePhoto? {
        references.first { $0.id == selectedReferenceID }
            ?? references.first(where: \ReferencePhoto.isDefault)
            ?? references.first
    }

    private func upsertDraftLook(selected: [Garment], looks: [Look], context: ModelContext) -> Look {
        if let activeLookID, let existing = looks.first(where: { $0.id == activeLookID }) {
            existing.garments = selected
            existing.updatedAt = .now
            return existing
        }
        let look = Look(name: String(localized: "Look \(looks.count + 1)"), garments: selected)
        context.insert(look)
        activeLookID = look.id
        return look
    }

    private func queueVariant(
        for look: Look,
        selected: [Garment],
        remoteConfigured: Bool,
        context: ModelContext
    ) -> RenderVariant {
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
        return variant
    }

    private func makeRemoteTask(for preparation: RenderPreparation) -> Task<RemoteRenderResult, Error>? {
        guard preparation.remoteConfigured, let referenceData = preparation.reference.imageData else { return nil }
        let input = RemoteLookInput(
            id: preparation.look.id,
            renderID: preparation.variant.id,
            name: preparation.look.name,
            garments: preparation.selected.compactMap(Self.remoteInput(for:)),
            reference: RemoteReferenceInput(
                id: preparation.reference.id,
                imageData: referenceData,
                remoteAssetID: preparation.reference.remoteAssetID,
                isGenerated: preparation.reference.isGeneratedReference,
                generatedFromVariantID: preparation.reference.generatedFromVariantID
            )
        )
        return Task { try await WearBloomAPI.shared.render(input) }
    }

    private static func remoteInput(for garment: Garment) -> RemoteGarmentInput? {
        guard let imageData = garment.imageData else { return nil }
        return RemoteGarmentInput(
            id: garment.id,
            name: garment.name,
            category: garment.category,
            imageData: garment.originalImageData ?? imageData,
            remoteAssetID: garment.remoteAssetID
        )
    }

    private func advanceRenderProgress() async -> Bool {
        let phases: [(Double, String, UInt64)] = [
            (0.22, String(localized: "Reading the silhouette…"), 650_000_000),
            (0.46, String(localized: "Composing color and shape…"), 800_000_000),
            (0.72, String(localized: "Bringing the look together…"), 850_000_000),
            (0.91, String(localized: "Finishing the details…"), 650_000_000)
        ]
        for phase in phases {
            guard !Task.isCancelled else { return false }
            try? await Task.sleep(nanoseconds: phase.2)
            withAnimation(.smooth(duration: 0.6)) {
                renderProgress = phase.0
                renderMessage = phase.1
            }
        }
        return true
    }

    private func resolveRender(
        _ preparation: RenderPreparation,
        remoteTask: Task<RemoteRenderResult, Error>?,
        context: ModelContext,
        isPro: Bool
    ) async -> Bool {
        guard let remoteTask else {
            preparation.variant.resultData = PreviewImageFactory.compose(
                referenceData: preparation.reference.imageData,
                garments: preparation.selected
            )
            preparation.variant.isPreviewSimulation = true
            return true
        }
        renderMessage = String(localized: "Rendering your personal preview…")
        renderProgress = 0.94
        do {
            apply(try await remoteTask.value, to: preparation, isPro: isPro)
            return true
        } catch {
            handleRenderFailure(error, variant: preparation.variant, context: context)
            return false
        }
    }

    private func apply(_ result: RemoteRenderResult, to preparation: RenderPreparation, isPro: Bool) {
        preparation.variant.resultData = result.data
        preparation.variant.isPreviewSimulation = false
        preparation.variant.remoteRenderID = result.renderID
        preparation.reference.remoteAssetID = result.referenceAsset
        for garment in preparation.selected { garment.remoteAssetID = result.garmentAssets[garment.id] }
        if !isPro { freeRendersUsed += 1 }
        if let serverRendersRemaining { self.serverRendersRemaining = max(0, serverRendersRemaining - 1) }
    }

    private func handleRenderFailure(_ error: Error, variant: RenderVariant, context: ModelContext) {
        renderingVariantID = nil
        renderProgress = 0
        if case APIClientError.timedOut = error {
            variant.state = .rendering
            context.saveReporting(operation: "render_background_state_save")
            Telemetry.event("render_continuing_in_background")
            showToast(error.localizedDescription)
            return
        }
        variant.state = .failed
        variant.completedAt = .now
        context.saveReporting(operation: "render_failure_save")
        Telemetry.error(error, context: ["operation": "render"])
        Telemetry.event("render_failed", properties: ["mode": "remote"])
        if case let APIClientError.server(code, _) = error, code == "QUOTA_EXHAUSTED" {
            serverRendersRemaining = 0
            isPaywallPresented = true
        } else {
            showToast(error.localizedDescription)
        }
    }

    private func finishRender(_ preparation: RenderPreparation, context: ModelContext) async {
        preparation.variant.state = .ready
        preparation.variant.completedAt = .now
        context.saveReporting(operation: "render_success_save")
        withAnimation(.smooth) { renderProgress = 1 }
        renderingVariantID = nil
        resultVariantID = preparation.variant.id
        Telemetry.event("render_succeeded", properties: [
            "piece_count": preparation.selected.count,
            "mode": preparation.variant.isPreviewSimulation ? "on_device_preview" : "remote"
        ])
        await RenderNotificationCenter.shared.notifyCompletion(lookName: preparation.look.name)
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

private struct RenderPreparation {
    let selected: [Garment]
    let reference: ReferencePhoto
    let look: Look
    let variant: RenderVariant
    let remoteConfigured: Bool
}
