import Photos
import SwiftData
import SwiftUI

struct LooksView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    @State private var selectedLook: Look?

    var body: some View {
        BloomPageScaffold(
            title: String(localized: "Looks"),
            subtitle: String(localized: "Saved outfits and personal previews"),
            bottomPadding: 126
        ) {
            session.isProfilePresented = true
        } content: {
            if looks.isEmpty {
                ContentUnavailableView {
                    Label("No looks yet", systemImage: "square.grid.2x2")
                } description: {
                    Text("Your saved outfits and previews will appear here.")
                } actions: {
                    Button("Create a look") { session.selectedTab = 1 }
                        .buttonStyle(BloomButtonStyle(fill: BloomColor.violet, compact: true))
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 72)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 24) {
                    ForEach(looks) { look in
                        LookCard(look: look) {
                            selectedLook = look
                        }
                        .contextMenu {
                            Button("Edit look", systemImage: "slider.horizontal.3") { session.load(look) }
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                let id = look.id
                                SynchronizedDeletion.perform(
                                    operation: "look_delete",
                                    remote: { try await RemoteLibraryCoordinator.shared.deleteLook(id) },
                                    local: {
                                        modelContext.delete(look)
                                        try modelContext.saveIfNeeded()
                                    },
                                    onFailure: { session.showToast(String(localized: "Couldn’t delete this look. Please try again.")) }
                                )
                            }
                        }
                    }
                }
            }
        }
        .sheet(item: $selectedLook) { look in
            NavigationStack {
                LookVariantsView(look: look)
                    .environment(session)
            }
        }
        .onAppear { Telemetry.event("screen_viewed", properties: ["screen": "saved_looks"]) }
    }
}

private struct LookCard: View {
    let look: Look
    let open: () -> Void

    private var latest: RenderVariant? {
        look.variants
            .filter { $0.state == .ready }
            .max { $0.createdAt < $1.createdAt }
    }

    var body: some View {
        Button(action: open) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    if let latest {
                        ImageDataView(data: latest.resultData)
                    } else {
                        BloomColor.softViolet
                        HStack(spacing: -10) {
                            ForEach(look.garments.prefix(3)) { garment in
                                ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                    .frame(width: 72, height: 92)
                                    .background(.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 16))
                                    .rotationEffect(.degrees(garment.id.hashValue.isMultiple(of: 2) ? -4 : 4))
                            }
                        }
                    }
                }
                .frame(height: 214)
                .clipped()

                VStack(alignment: .leading, spacing: 3) {
                    Text(look.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(BloomColor.ink)
                        .lineLimit(1)
                    Text(look.variants.isEmpty
                        ? String(localized: "Saved outfit")
                        : String(localized: "\(look.variants.count) previews"))
                        .font(.caption)
                        .foregroundStyle(BloomColor.muted)
                }
                .padding(.horizontal, 11)
                .frame(maxWidth: .infinity, minHeight: 62, alignment: .leading)
            }
            .background(BloomColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(BloomColor.ink.opacity(0.14), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.04), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
    }
}

private struct LookVariantsView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Bindable var look: Look
    @State private var selectedVariant: RenderVariant?

    private var variants: [RenderVariant] {
        look.variants.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if variants.isEmpty {
                    ContentUnavailableView(
                        "No previews yet",
                        systemImage: "sparkles",
                        description: Text("Edit this look to create its first personal preview.")
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.top, 70)
                } else {
                    Text("Every preview is kept as its own variant.")
                        .font(.subheadline)
                        .foregroundStyle(BloomColor.muted)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(variants) { variant in
                            Button {
                                if variant.state == .ready { selectedVariant = variant }
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    ZStack {
                                        ImageDataView(data: variant.resultData, fallback: "sparkles")
                                        if variant.state != .ready {
                                            BloomColor.ink.opacity(0.58)
                                            VStack(spacing: 8) {
                                                if variant.state == .queued || variant.state == .rendering {
                                                    ProgressView().tint(.white)
                                                }
                                                Text(variant.state == .failed ? String(localized: "Failed") : String(localized: "Rendering"))
                                                    .font(.caption.weight(.bold))
                                                    .foregroundStyle(.white)
                                            }
                                        }
                                    }
                                    .frame(height: 225)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 20))
                                    Text("Variant \(variant.sequence)")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(BloomColor.ink)
                                    Text(variant.createdAt, format: .dateTime.month(.abbreviated).day().year())
                                        .font(.caption)
                                        .foregroundStyle(BloomColor.muted)
                                }
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                if variant.state == .ready || variant.state == .failed {
                                    Button("Delete variant", systemImage: "trash", role: .destructive) {
                                        delete(variant)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(18)
        }
        .background(BloomColor.cream)
        .navigationTitle(look.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            ToolbarItem(placement: .primaryAction) {
                Button("Edit") {
                    session.load(look)
                    dismiss()
                }
            }
        }
        .fullScreenCover(item: $selectedVariant) { variant in
            NavigationStack { ResultView(variant: variant).environment(session) }
        }
    }

    private func delete(_ variant: RenderVariant) {
        let remoteID = variant.remoteRenderID
        SynchronizedDeletion.perform(
            operation: "render_delete",
            remote: { try await RemoteLibraryCoordinator.shared.deleteRender(remoteID) },
            local: {
                modelContext.delete(variant)
                try modelContext.saveIfNeeded()
            },
            onFailure: { session.showToast(String(localized: "Couldn’t delete this preview. Please try again.")) }
        )
    }
}

struct ResultView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Bindable var variant: RenderVariant
    @State private var savedToPhotos = false
    @State private var isDeleteConfirmationPresented = false

    var body: some View {
        ZStack {
            BloomColor.ink.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    resultImage
                    details
                }
            }
            .scrollIndicators(.hidden)
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            Telemetry.event("render_revealed", properties: [
                "mode": variant.isPreviewSimulation ? "on_device_preview" : "remote",
                "sequence": variant.sequence
            ])
        }
        .onChange(of: variant.feedbackLooksLikeMe) { _, _ in submitFeedbackIfComplete() }
        .onChange(of: variant.feedbackHelpful) { _, _ in submitFeedbackIfComplete() }
        .confirmationDialog(
            "Delete this preview?",
            isPresented: $isDeleteConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("Delete preview", role: .destructive) { deleteVariant() }
        } message: {
            Text("This removes this generated variant and its private server file. Your editable look remains.")
        }
    }

    private var resultImage: some View {
        ZStack(alignment: .top) {
            ImageDataView(data: variant.resultData)
                .frame(height: 610)
                .clipped()
            LinearGradient(colors: [.black.opacity(0.55), .clear], startPoint: .top, endPoint: .center)
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 42, height: 42)
                        .background(.ultraThinMaterial, in: Circle())
                }
                Spacer()
                Button { isDeleteConfirmationPresented = true } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 42, height: 42)
                        .background(.ultraThinMaterial, in: Circle())
                }
                if let data = variant.resultData,
                   let image = ShareImageRenderer.makeVerticalStory(
                    resultData: data,
                    lookName: variant.look?.name ?? String(localized: "My look")
                   ) {
                    ShareLink(
                        item: Image(uiImage: image),
                        preview: SharePreview("My WearBloom look", image: Image(uiImage: image))
                    ) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 15, weight: .semibold))
                            .frame(width: 42, height: 42)
                            .background(.ultraThinMaterial, in: Circle())
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.top, 10)
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .firstTextBaseline) {
                Text(variant.look?.name ?? "Your look")
                    .font(.title2.weight(.semibold))
                Spacer()
                if variant.isPreviewSimulation {
                    Text("Preview")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .frame(height: 28)
                        .background(BloomColor.softViolet, in: Capsule())
                        .foregroundStyle(BloomColor.violet)
                }
            }

            Text(variant.garmentSnapshot)
                .font(.subheadline)
                .foregroundStyle(BloomColor.muted)
                .lineLimit(2)

            VStack(spacing: 16) {
                HStack {
                    Text("Looks like you?")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    FeedbackControl(value: $variant.feedbackLooksLikeMe)
                        .frame(width: 180)
                }
                HStack {
                    Text("Helpful?")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    FeedbackControl(value: $variant.feedbackHelpful)
                        .frame(width: 180)
                }
            }
            .padding(16)
            .background(BloomColor.cream, in: RoundedRectangle(cornerRadius: 20))

            HStack(spacing: 12) {
                Button("Edit look", systemImage: "slider.horizontal.3") {
                    if let look = variant.look { session.load(look) }
                    dismiss()
                }
                .buttonStyle(BloomOutlineButtonStyle())
                Button(savedToPhotos ? String(localized: "Saved") : String(localized: "Save photo"), systemImage: savedToPhotos ? "checkmark" : "arrow.down") {
                    saveToPhotos()
                }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
            }

            Label(
                "Your result stays private. It is saved or shared only when you choose one of these actions.",
                systemImage: "lock.fill"
            )
            .font(.caption)
            .foregroundStyle(BloomColor.muted)

            Button("Use as a reference photo", systemImage: "person.crop.rectangle.stack") {
                reuseAsReference()
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(BloomColor.violet)
            .frame(maxWidth: .infinity)
        }
        .padding(20)
        .padding(.bottom, 30)
        .background(BloomColor.paper)
    }

    private func saveToPhotos() {
        guard let data = variant.resultData, let image = UIImage(data: data) else { return }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else { return }
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            Task { @MainActor in savedToPhotos = true }
            Telemetry.event("render_saved_to_photos")
        }
    }

    private func reuseAsReference() {
        let photo = ReferencePhoto(
            name: String(localized: "Generated look \(variant.sequence)"),
            imageData: variant.resultData,
            isDefault: false,
            isGeneratedReference: true,
            generatedFromVariantID: variant.remoteRenderID
        )
        modelContext.insert(photo)
        guard modelContext.saveReporting(operation: "generated_reference_save") else {
            modelContext.rollback()
            session.showToast(String(localized: "Couldn’t save this reference. Please try again."))
            return
        }
        Telemetry.event("generated_reference_created")
        session.showToast(String(localized: "Added as a generated reference."))
    }

    private func deleteVariant() {
        let remoteID = variant.remoteRenderID
        SynchronizedDeletion.perform(
            operation: "render_delete",
            remote: { try await RemoteLibraryCoordinator.shared.deleteRender(remoteID) },
            local: {
                modelContext.delete(variant)
                try modelContext.saveIfNeeded()
                dismiss()
            },
            onFailure: { session.showToast(String(localized: "Couldn’t delete this preview. Please try again.")) }
        )
    }

    private func submitFeedbackIfComplete() {
        guard let looksLikeMe = variant.feedbackLooksLikeMe,
              let helpful = variant.feedbackHelpful else { return }
        modelContext.saveReporting(operation: "render_feedback_save")
        Telemetry.event("render_feedback_submitted", properties: [
            "looks_like_me": looksLikeMe,
            "helpful": helpful,
            "mode": variant.isPreviewSimulation ? "on_device_preview" : "remote"
        ])
        guard let remoteRenderID = variant.remoteRenderID else { return }
        Task {
            do {
                try await RemoteLibraryCoordinator.shared.sendFeedback(
                    renderID: remoteRenderID,
                    looksLikeMe: looksLikeMe,
                    helpful: helpful
                )
            } catch {
                Telemetry.error(error, context: ["operation": "render_feedback"])
            }
        }
    }
}

private struct FeedbackControl: View {
    @Binding var value: Bool?

    var body: some View {
        HStack(spacing: 8) {
            Button { value = true } label: {
                Label("Yes", systemImage: "hand.thumbsup")
            }
            .buttonStyle(FeedbackButtonStyle(selected: value == true))
            Button { value = false } label: {
                Image(systemName: "hand.thumbsdown")
            }
            .buttonStyle(FeedbackButtonStyle(selected: value == false))
            .accessibilityLabel("No")
        }
    }
}

private struct FeedbackButtonStyle: ButtonStyle {
    let selected: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .semibold))
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(selected ? BloomColor.softViolet : BloomColor.paper, in: Capsule())
            .foregroundStyle(selected ? BloomColor.violet : BloomColor.muted)
            .overlay(Capsule().stroke(selected ? BloomColor.violet.opacity(0.35) : BloomColor.line, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
