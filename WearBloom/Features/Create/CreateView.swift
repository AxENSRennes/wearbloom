import PhotosUI
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
        !selectedGarments.isEmpty && selectedReference != nil && session.renderingVariantID == nil
    }

    var body: some View {
        ZStack {
            BloomPageBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    BloomHeader(
                        title: session.activeLookID == nil ? "Style" : "Edit look",
                        subtitle: "Compose, remix, then try it on"
                    ) { session.isProfilePresented = true }

                    HStack(spacing: 10) {
                        Button { suggestOutfit() } label: {
                            BloomPill(title: "Fresh remix", systemImage: "sparkles", selected: true)
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

                    outfitBoard
                    outfitSection
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 130)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
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
            AIProcessingConsentView {
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
                    if await WearBloomAPI.shared.isConfigured && !session.hasAIProcessingConsent {
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
        ZStack {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(BloomColor.paper.opacity(0.9))
            OrganicBlob()
                .fill(BloomColor.blue)
                .frame(width: 190, height: 180)
                .offset(x: 130, y: -165)
            Circle()
                .fill(BloomColor.lime)
                .frame(width: 130)
                .offset(x: -145, y: 175)

            if selectedGarments.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "hanger")
                        .font(.system(size: 44, weight: .medium))
                    Text("Choose pieces from your closet")
                        .font(.system(size: 17, weight: .bold))
                    Button("Open closet") { session.selectedTab = 0 }
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(BloomColor.blue)
                }
            } else {
                HStack(alignment: .center, spacing: -18) {
                    ForEach(Array(selectedGarments.enumerated()), id: \.element.id) { index, garment in
                        Button { withAnimation(.snappy) { activeBoardCategory = garment.category } } label: {
                            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                .frame(
                                    width: selectedGarments.count == 2 ? 165 : (index == 1 ? 155 : 135),
                                    height: selectedGarments.count == 2 ? 275 : (index == 1 ? 245 : 210)
                                )
                                .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 25))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 25)
                                        .stroke(activeBoardCategory == garment.category ? BloomColor.blue : .clear, lineWidth: 4)
                                }
                                .rotationEffect(.degrees(index.isMultiple(of: 2) ? -5 : 5))
                                .shadow(color: .black.opacity(0.09), radius: 14, y: 7)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Button { isReferencePickerPresented = true } label: {
                ZStack(alignment: .bottomTrailing) {
                    ImageDataView(data: selectedReference?.imageData)
                        .frame(width: 90, height: 126)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(BloomColor.ink, lineWidth: 3))
                    Image(systemName: "photo")
                        .font(.system(size: 12, weight: .black))
                        .frame(width: 28, height: 28)
                        .background(BloomColor.lime, in: Circle())
                        .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
                        .offset(x: 7, y: 7)
                }
            }
            .buttonStyle(.plain)
            .rotationEffect(.degrees(-4))
            .offset(x: -122, y: -142)
            .accessibilityLabel(selectedReference == nil ? "Add your photo" : "Change your photo")

            VStack {
                Spacer()
                if let activeBoardCategory,
                   let garment = session.garment(for: activeBoardCategory, in: garments) {
                    HStack(spacing: 10) {
                        Text(garment.name)
                            .font(.system(size: 13, weight: .black))
                            .lineLimit(1)
                        Spacer()
                        Button("Replace", systemImage: "arrow.triangle.2.circlepath") {
                            pickingCategory = activeBoardCategory
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(BloomColor.blue)
                        Button("Remove", systemImage: "trash") {
                            session.remove(category: activeBoardCategory)
                            self.activeBoardCategory = nil
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(BloomColor.coral)
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 1.4))
                    .padding(14)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if !selectedGarments.isEmpty {
                    Text("Tap a piece to replace or remove it")
                        .font(.system(size: 12, weight: .bold))
                        .padding(.horizontal, 14)
                        .frame(height: 34)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.bottom, 14)
                }
            }
        }
        .frame(height: 470)
        .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 34).stroke(BloomColor.ink, lineWidth: 2))
    }

    private var referenceCard: some View {
        Button { isReferencePickerPresented = true } label: {
            ZStack(alignment: .bottom) {
                if let reference = selectedReference {
                    ImageDataView(data: reference.imageData)
                        .frame(height: 390)
                        .clipped()
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "person.crop.rectangle.badge.plus")
                            .font(.system(size: 38, weight: .light))
                        Text("Add your photo").font(.headline)
                    }
                    .foregroundStyle(BloomColor.violet)
                    .frame(maxWidth: .infinity)
                    .frame(height: 390)
                    .background(BloomColor.softViolet)
                }

                LinearGradient(
                    colors: [.clear, .black.opacity(selectedReference == nil ? 0 : 0.62)],
                    startPoint: .center,
                    endPoint: .bottom
                )

                HStack(alignment: .bottom, spacing: 10) {
                    if !selectedGarments.isEmpty {
                        HStack(spacing: -7) {
                            ForEach(selectedGarments.prefix(3)) { garment in
                                ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                    .frame(width: 48, height: 58)
                                    .background(.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 13).stroke(.white.opacity(0.7), lineWidth: 1)
                                    }
                            }
                        }
                    }
                    Spacer()
                    Label(selectedReference == nil ? "Add photo" : "Change", systemImage: "photo")
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.horizontal, 13)
                        .frame(height: 38)
                        .background(.ultraThinMaterial, in: Capsule())
                        .foregroundStyle(selectedReference == nil ? BloomColor.ink : .white)
                }
                .padding(14)
            }
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(BloomColor.line, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(selectedReference == nil ? "Add your photo" : "Change your photo")
    }

    private var outfitSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Replace a piece")
                    .font(.system(size: 20, weight: .black, design: .rounded))
                Spacer()
                if session.selectedGarmentIDs[.dress] == nil {
                    Button("Use a dress") { pickingCategory = .dress }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(BloomColor.blue)
                } else {
                    Button("Use separates") {
                        session.remove(category: .dress)
                        pickingCategory = .top
                    }
                    .font(.subheadline.weight(.bold))
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
                    .font(.caption.weight(.medium))
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
                Image(systemName: "bookmark")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 54, height: 54)
                    .background(BloomColor.paper, in: Circle())
                    .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
            }
            .foregroundStyle(BloomColor.ink)
            .accessibilityLabel("Save look")

            Button {
                isTryOnPrepPresented = true
            } label: {
                HStack {
                    Label("Try this outfit", systemImage: "sparkles")
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
            await RenderNotificationCenter.shared.requestPermission()
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
        try? modelContext.save()
        Telemetry.event("look_saved", properties: ["piece_count": selected.count])
        session.showToast(String(localized: "Look saved."))
    }

    private func suggestOutfit() {
        let available = garments.filter { !$0.isArchived }
        let byRediscovery = available.sorted {
            if $0.wearCount == $1.wearCount { return $0.createdAt < $1.createdAt }
            return $0.wearCount < $1.wearCount
        }
        session.resetDraft()
        if let top = byRediscovery.first(where: { $0.category == .top }) { session.select(top) }
        if let bottom = byRediscovery.first(where: { $0.category == .bottom }) { session.select(bottom) }
        if let layer = byRediscovery.first(where: { $0.category == .outerwear && $0.wearCount == 0 }) {
            session.select(layer)
        }
        Telemetry.event("wardrobe_remix_suggested", properties: [
            "piece_count": session.selectedGarmentIDs.count,
            "reason": "least_worn"
        ])
        session.showToast(String(localized: "A fresh mix built from your least-worn pieces."))
    }
}

private struct TryOnPrepView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \ReferencePhoto.createdAt, order: .reverse) private var references: [ReferencePhoto]
    let reference: ReferencePhoto?
    let garments: [Garment]
    let continueAction: () -> Void
    @State private var isReferencePickerPresented = false

    private var currentReference: ReferencePhoto? {
        references.first { $0.id == session.selectedReferenceID } ?? reference
    }

    var body: some View {
        ZStack {
            BloomColor.cream.ignoresSafeArea()
            OrganicBlob()
                .fill(BloomColor.blue)
                .frame(width: 210, height: 180)
                .rotationEffect(.degrees(20))
                .offset(x: 225, y: -410)
            Circle()
                .fill(BloomColor.lime)
                .frame(width: 170)
                .offset(x: -210, y: 380)

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack {
                        Button { dismiss() } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 17, weight: .black))
                                .frame(width: 44, height: 44)
                                .background(.white, in: Circle())
                                .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
                        }
                        .foregroundStyle(BloomColor.ink)
                        Spacer()
                        Text("Try on")
                            .font(.system(size: 19, weight: .black, design: .rounded))
                        Spacer()
                        Color.clear.frame(width: 44, height: 44)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Ready to see it on you?")
                            .font(.system(size: 29, weight: .black, design: .rounded))
                        Text("One clear photo and the pieces you chose. You stay in control of what is processed.")
                            .font(.system(size: 15))
                            .foregroundStyle(BloomColor.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Button { isReferencePickerPresented = true } label: {
                        ImageDataView(data: currentReference?.imageData)
                            .frame(maxWidth: .infinity)
                            .frame(height: 420)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 30))
                            .overlay(RoundedRectangle(cornerRadius: 30).stroke(BloomColor.blue, lineWidth: 4))
                            .overlay(alignment: .bottomTrailing) {
                                Label(currentReference == nil ? "Add photo" : "Change photo", systemImage: "photo")
                                    .font(.system(size: 13, weight: .black))
                                    .foregroundStyle(BloomColor.ink)
                                    .padding(.horizontal, 14)
                                    .frame(height: 40)
                                    .background(BloomColor.lime, in: Capsule())
                                    .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 1.4))
                                    .padding(14)
                            }
                    }
                    .buttonStyle(.plain)

                    VStack(alignment: .leading, spacing: 9) {
                        Text("YOUR OUTFIT")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(BloomColor.muted)
                        ScrollView(.horizontal) {
                            HStack(spacing: 10) {
                                ForEach(garments) { garment in
                                    ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                        .frame(width: 74, height: 82)
                                        .background(.white, in: RoundedRectangle(cornerRadius: 18))
                                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(BloomColor.ink, lineWidth: 1.2))
                                }
                            }
                            .padding(.vertical, 1)
                        }
                        .scrollIndicators(.hidden)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 10)
                .padding(.bottom, 96)
            }
            .scrollIndicators(.hidden)
            .safeAreaInset(edge: .bottom) {
                Button(action: continueAction) {
                    HStack {
                        Label("See it on me", systemImage: "sparkles")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
                .disabled(currentReference == nil || garments.isEmpty)
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial)
            }
        }
        .preferredColorScheme(.light)
        .sheet(isPresented: $isReferencePickerPresented) { ReferencePickerView() }
    }
}

private struct AIProcessingConsentView: View {
    @Environment(\.dismiss) private var dismiss
    let consent: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Image(systemName: "wand.and.stars.inverse")
                        .font(.system(size: 52))
                        .foregroundStyle(BloomColor.violet)
                    Text("Allow AI photo processing?")
                        .font(.system(size: 30, weight: .bold))
                    Text("To create a preview, WearBloom uploads the reference photo and garment photos you selected to our private servers and shares them with OpenAI, our AI image provider.")
                    Text("The photos are used to classify garments and create your requested preview. They are not used for advertising or cross-app tracking. You can withdraw permission in Settings and delete stored photos and account data at any time.")
                        .foregroundStyle(.secondary)
                    Link("Read the privacy policy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
                        .fontWeight(.semibold)
                    Button("Allow and create preview") {
                        dismiss()
                        consent()
                    }
                    .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
                    Button("Not now") { dismiss() }
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(BloomColor.muted)
                }
                .padding(22)
            }
            .background(BloomColor.cream)
            .navigationTitle("AI processing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

private struct GarmentPickerView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Garment.createdAt, order: .reverse) private var garments: [Garment]
    let category: GarmentCategory

    private var options: [Garment] { garments.filter { $0.category == category } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if options.isEmpty {
                    ContentUnavailableView(
                        "No \(category.title.lowercased()) yet",
                        systemImage: category.symbol,
                        description: Text("Add one in Closet first.")
                    )
                    .padding(.top, 70)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 18) {
                        ForEach(options) { garment in
                            Button {
                                session.select(garment)
                                dismiss()
                            } label: {
                                GarmentCard(garment: garment)
                                    .overlay {
                                        if session.selectedGarmentIDs[category] == garment.id {
                                            RoundedRectangle(cornerRadius: 20)
                                                .stroke(BloomColor.violet, lineWidth: 3)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
            .background(BloomColor.cream)
            .navigationTitle(category.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                if session.selectedGarmentIDs[category] != nil {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Remove", role: .destructive) {
                            session.remove(category: category)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

private struct ReferencePickerView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ReferencePhoto.createdAt, order: .reverse) private var references: [ReferencePhoto]
    @State private var item: PhotosPickerItem?
    @State private var isCameraPresented = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    PhotoGuideView()
                    HStack(spacing: 12) {
                        PhotosPicker(selection: $item, matching: .images) {
                            Label("Photos", systemImage: "photo")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(BloomOutlineButtonStyle())
                        Button { isCameraPresented = true } label: {
                            Label("Camera", systemImage: "camera")
                        }
                        .buttonStyle(BloomOutlineButtonStyle())
                    }
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(references) { photo in
                            Button {
                                session.selectedReferenceID = photo.id
                                dismiss()
                            } label: {
                                ImageDataView(data: photo.imageData)
                                    .frame(height: 230)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 20))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(
                                                session.selectedReferenceID == photo.id ? BloomColor.violet : BloomColor.line,
                                                lineWidth: session.selectedReferenceID == photo.id ? 3 : 1
                                            )
                                    }
                                    .overlay(alignment: .bottomLeading) {
                                        if photo.isDefault || photo.isGeneratedReference {
                                            Text(photo.isGeneratedReference ? "Generated" : "Default")
                                                .font(.caption2.weight(.semibold))
                                                .padding(.horizontal, 9)
                                                .frame(height: 27)
                                                .background(.ultraThinMaterial, in: Capsule())
                                                .padding(9)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .background(BloomColor.cream)
            .navigationTitle("Your photos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
            .onChange(of: item) { _, item in
                Task {
                    if let data = try? await item?.loadTransferable(type: Data.self) { add(data) }
                }
            }
            .fullScreenCover(isPresented: $isCameraPresented) {
                CameraPicker { add($0) }.ignoresSafeArea()
            }
        }
    }

    private func add(_ data: Data) {
        for reference in references { reference.isDefault = false }
        let photo = ReferencePhoto(
            name: String(localized: "Reference \(references.count + 1)"),
            imageData: data,
            isDefault: true
        )
        modelContext.insert(photo)
        try? modelContext.save()
        Telemetry.event("reference_added", properties: ["source": "photo_library_or_camera"])
        session.selectedReferenceID = photo.id
    }
}

private struct RenderProgressView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            BloomColor.ink.ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer()
                ZStack {
                    Circle().stroke(.white.opacity(0.12), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: max(session.renderProgress, 0.03))
                        .stroke(BloomColor.lime, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: "sparkles")
                        .font(.system(size: 34, weight: .medium))
                        .foregroundStyle(.white)
                }
                .frame(width: 148, height: 148)
                Text(session.renderMessage)
                    .font(.title2.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                Text("\(Int(session.renderProgress * 100))%")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.55))
                Spacer()
                Button("Keep browsing") { dismiss() }
                    .buttonStyle(BloomButtonStyle(fill: .white))
                    .padding(.horizontal, 24)
                Text("We’ll let you know when it’s ready.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.bottom, 24)
        }
    }
}
