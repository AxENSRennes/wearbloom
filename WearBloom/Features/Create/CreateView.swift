import SwiftData
import SwiftUI

struct CreateView: View {
    @Environment(AppSession.self) private var session
    @Environment(SubscriptionManager.self) private var subscriptions
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Garment.createdAt, order: .reverse) private var garments: [Garment]
    @Query(sort: \ReferencePhoto.createdAt, order: .reverse) private var references: [ReferencePhoto]
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    @Query(sort: \RenderVariant.createdAt, order: .reverse) private var variants: [RenderVariant]
    @State private var pickingCategory: GarmentCategory?
    @State private var isReferencePickerPresented = false
    @State private var isRenderingPresented = false
    @State private var isTryOnPrepPresented = false
    @State private var isAIConsentPresented = false
    @State private var shouldRenderAfterConsent = false
    @State private var resultVariant: RenderVariant?
    @State private var isLooksPresented = false
    @State private var activeBoardCategory: GarmentCategory?

    private var selectedReference: ReferencePhoto? {
        references.first { $0.id == session.selectedReferenceID }
            ?? references.first(where: { $0.isDefault })
            ?? references.first
    }

    private var selectedGarments: [Garment] {
        garments.filter { session.selectedGarmentIDs.values.contains($0.id) }
    }

    private var canRender: Bool {
        LookComposition.isComplete(selectedGarments)
            && selectedReference != nil
            && session.renderingVariantID == nil
    }

    private var renderActionTitle: String {
        if selectedGarments.isEmpty { return String(localized: "Choose your pieces") }
        if !LookComposition.isComplete(selectedGarments) { return String(localized: "Complete your outfit") }
        if selectedReference == nil { return String(localized: "Add your photo") }
        return String(localized: "Try this outfit")
    }

    var body: some View {
        BloomPageScaffold(
            title: session.activeLookID == nil ? String(localized: "Create") : String(localized: "Edit look"),
            subtitle: String(localized: "Build an outfit, then see it on you"),
            contentSpacing: 18,
            bottomPadding: 138,
            viewportBottomPadding: 0
        ) {
            session.isProfilePresented = true
        } content: {
            HStack(spacing: 10) {
                Button { suggestOutfit() } label: {
                    BloomPill(title: "Suggest outfit", systemImage: "sparkles")
                }
                .buttonStyle(.plain)
                Button { isLooksPresented = true } label: {
                    BloomPill(title: "Saved looks", systemImage: "square.grid.2x2")
                }
                .buttonStyle(.plain)
                if session.activeLookID != nil {
                    Button { session.resetDraft() } label: {
                        BloomPill(title: "New", systemImage: "plus")
                    }
                    .buttonStyle(.plain)
                }
            }

            outfitSection
            outfitBoard
        }
        .safeAreaInset(edge: .bottom) {
            actionBar
        }
        .sheet(item: $pickingCategory) { category in
            GarmentPickerView(category: category)
        }
        .sheet(isPresented: $isReferencePickerPresented) {
            ReferencePickerView()
        }
        .sheet(isPresented: $isLooksPresented) {
            NavigationStack { LooksView() }
        }
        .sheet(isPresented: $isAIConsentPresented, onDismiss: {
            guard shouldRenderAfterConsent else { return }
            shouldRenderAfterConsent = false
            startRender()
        }) {
            AIProcessingConsentView(primaryActionTitle: String(localized: "Allow and create preview")) {
                session.setAIProcessingConsent(true)
                shouldRenderAfterConsent = true
            }
        }
        .fullScreenCover(isPresented: $isRenderingPresented) {
            RenderProgressView().environment(session)
        }
        .fullScreenCover(isPresented: $isTryOnPrepPresented) {
            TryOnPrepView(reference: selectedReference, garments: selectedGarments) {
                isTryOnPrepPresented = false
                Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    if await RemoteLibraryCoordinator.shared.isConfigured && !session.hasAIProcessingConsent {
                        isAIConsentPresented = true
                    } else {
                        startRender()
                    }
                }
            }
        }
        .fullScreenCover(item: $resultVariant) { variant in
            NavigationStack {
                ResultView(variant: variant).environment(session)
            }
        }
        .onAppear {
            if session.selectedReferenceID == nil { session.selectedReferenceID = selectedReference?.id }
            Telemetry.event("screen_viewed", properties: ["screen": "style"])
        }
        .task {
#if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-reviewBoardEdit") {
                try? await Task.sleep(for: .milliseconds(700))
                activeBoardCategory = .top
            }
            if ProcessInfo.processInfo.arguments.contains("-reviewPrep") {
                try? await Task.sleep(for: .milliseconds(700))
                isTryOnPrepPresented = true
            }
#endif
        }
        .onChange(of: session.resultVariantID) { _, newID in
            guard let newID, let variant = variants.first(where: { $0.id == newID }) else { return }
            isRenderingPresented = false
            resultVariant = variant
        }
    }

    private var outfitBoard: some View {
        CreateOutfitBoard(
            garments: garments,
            selectedGarments: selectedGarments,
            selectedReference: selectedReference,
            activeCategory: $activeBoardCategory,
            pickingCategory: $pickingCategory,
            isReferencePickerPresented: $isReferencePickerPresented
        )
    }

    private var outfitSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Build your outfit")
                        .font(BloomTypography.sectionTitle)
                    Text("Choose a dress, or pair a top and bottom. Outerwear is optional.")
                        .font(BloomTypography.footnoteMedium)
                        .foregroundStyle(BloomColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer()
                if session.selectedGarmentIDs[.dress] == nil {
                    Button("Use a dress") { pickingCategory = .dress }
                        .font(BloomTypography.subheadlineMedium)
                        .foregroundStyle(BloomColor.blue)
                } else {
                    Button("Use separates") {
                        session.remove(category: .dress)
                        pickingCategory = .top
                    }
                    .font(BloomTypography.subheadlineMedium)
                    .foregroundStyle(BloomColor.blue)
                }
            }

            if session.selectedGarmentIDs[.dress] != nil {
                HStack(spacing: 12) {
                    slot(for: .dress)
                    slot(for: .outerwear)
                }
            } else {
                HStack(spacing: 12) {
                    slot(for: .top)
                    slot(for: .bottom)
                    slot(for: .outerwear)
                }
            }
        }
    }

    private func slot(for category: GarmentCategory) -> some View {
        let garment = session.garment(for: category, in: garments)
        return Button { pickingCategory = category } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(garment == nil ? BloomColor.paper : BloomColor.softBlue.opacity(0.52))
                    if let garment {
                        ImageDataView(data: garment.imageData, contentMode: .fit, fallback: category.symbol)
                            .padding(4)
                    } else {
                        Image(systemName: "plus")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(BloomColor.blue)
                    }
                }
                .frame(height: 112)
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(BloomColor.ink, lineWidth: 1.3)
                }

                Text(garment?.name ?? category.title)
                    .font(BloomTypography.captionMedium)
                    .foregroundStyle(garment == nil ? BloomColor.muted : BloomColor.ink)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .contextMenu {
            if garment != nil {
                Button("Remove", systemImage: "xmark") { session.remove(category: category) }
            }
        }
    }

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button { saveDraft() } label: {
                Label("Save", systemImage: "bookmark")
            }
            .buttonStyle(BloomOutlineButtonStyle())
            .frame(width: 96)

            Button {
                isTryOnPrepPresented = true
            } label: {
                HStack {
                    Label(renderActionTitle, systemImage: canRender ? "sparkles" : "checklist")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
            .disabled(!canRender)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    private func startRender() {
        isRenderingPresented = true
        Task {
            await session.beginRender(
                garments: garments,
                references: references,
                looks: looks,
                context: modelContext,
                isPro: subscriptions.isPro
            )
        }
    }

    private func saveDraft() {
        let selected = selectedGarments
        guard !selected.isEmpty else {
            session.showToast(String(localized: "Add a piece before saving."))
            return
        }
        if let id = session.activeLookID, let look = looks.first(where: { $0.id == id }) {
            look.garments = selected
            look.updatedAt = .now
        } else {
            let look = Look(name: String(localized: "Look \(looks.count + 1)"), garments: selected)
            modelContext.insert(look)
            session.activeLookID = look.id
        }
        guard modelContext.saveReporting(operation: "look_save") else {
            modelContext.rollback()
            session.showToast(String(localized: "Couldn’t save this look. Please try again."))
            return
        }
        Telemetry.event("look_saved", properties: ["piece_count": selected.count])
        session.showToast(String(localized: "Look saved."))
    }

    private func suggestOutfit() {
        let available = garments.filter { !$0.isArchived }
        let byRediscovery = available.sorted { $0.createdAt < $1.createdAt }
        session.resetDraft()
        if let top = byRediscovery.first(where: { $0.category == .top }) { session.select(top) }
        if let bottom = byRediscovery.first(where: { $0.category == .bottom }) { session.select(bottom) }
        if let layer = byRediscovery.first(where: { $0.category == .outerwear }) {
            session.select(layer)
        }
        Telemetry.event("wardrobe_remix_suggested", properties: [
            "piece_count": session.selectedGarmentIDs.count,
            "reason": "oldest_saved"
        ])
        session.showToast(String(localized: "A fresh mix built from your closet."))
    }
}
