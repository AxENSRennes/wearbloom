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
    @State private var resultVariant: RenderVariant?

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
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                referenceCard
                outfitSection
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 30)
        }
        .background(BloomColor.cream)
        .navigationTitle(session.activeLookID == nil ? "Create" : "Edit look")
        .navigationBarTitleDisplayMode(.large)
        .safeAreaInset(edge: .bottom) {
            actionBar
        }
        .toolbar {
            if session.activeLookID != nil {
                ToolbarItem(placement: .topBarLeading) {
                    Button("New") { session.resetDraft() }
                }
            }
            WearBloomToolbar()
        }
        .sheet(item: $pickingCategory) { category in
            GarmentPickerView(category: category)
        }
        .sheet(isPresented: $isReferencePickerPresented) {
            ReferencePickerView()
        }
        .fullScreenCover(isPresented: $isRenderingPresented) {
            RenderProgressView().environment(session)
        }
        .fullScreenCover(item: $resultVariant) { variant in
            NavigationStack {
                ResultView(variant: variant).environment(session)
            }
        }
        .onAppear {
            if session.selectedReferenceID == nil { session.selectedReferenceID = selectedReference?.id }
        }
        .onChange(of: session.resultVariantID) { _, newID in
            guard let newID, let variant = variants.first(where: { $0.id == newID }) else { return }
            isRenderingPresented = false
            resultVariant = variant
        }
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
                Text("Outfit")
                    .font(.title2.weight(.semibold))
                Spacer()
                if session.selectedGarmentIDs[.dress] == nil {
                    Button("Use a dress") { pickingCategory = .dress }
                        .font(.subheadline.weight(.medium))
                } else {
                    Button("Use separates") {
                        session.remove(category: .dress)
                        pickingCategory = .top
                    }
                    .font(.subheadline.weight(.medium))
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
                        .fill(garment == nil ? BloomColor.paper : BloomColor.softViolet.opacity(0.45))
                    if let garment {
                        ImageDataView(data: garment.imageData, contentMode: .fit, fallback: category.symbol)
                            .padding(4)
                    } else {
                        Image(systemName: "plus")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(BloomColor.violet)
                    }
                }
                .frame(height: 112)
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(BloomColor.line, lineWidth: 1)
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
                    .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(BloomColor.line, lineWidth: 1))
            }
            .foregroundStyle(BloomColor.ink)
            .accessibilityLabel("Save look")

            Button {
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
            } label: {
                Label("Create preview", systemImage: "sparkles")
            }
            .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
            .disabled(!canRender)
            .opacity(canRender ? 1 : 0.4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
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
