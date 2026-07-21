import Photos
import SwiftData
import SwiftUI

struct LooksView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    @State private var selectedVariant: RenderVariant?

    var body: some View {
        ScrollView {
            if looks.isEmpty {
                ContentUnavailableView {
                    Label("No looks yet", systemImage: "square.grid.2x2")
                } description: {
                    Text("Your saved outfits and previews will appear here.")
                } actions: {
                    Button("Create a look") { session.selectedTab = 1 }
                        .buttonStyle(BloomButtonStyle(fill: BloomColor.violet, compact: true))
                }
                .padding(.top, 90)
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 24) {
                    ForEach(looks) { look in
                        LookCard(look: look) { variant in
                            selectedVariant = variant
                        } edit: {
                            session.load(look)
                        }
                        .contextMenu {
                            Button("Edit look", systemImage: "slider.horizontal.3") { session.load(look) }
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                let id = look.id
                                modelContext.delete(look)
                                Task {
                                    do { try await WearBloomAPI.shared.deleteLook(id) }
                                    catch { Telemetry.error(error, context: ["operation": "look_delete"]) }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 6)
                .padding(.bottom, 32)
            }
        }
        .background(BloomColor.cream)
        .navigationTitle("Looks")
        .navigationBarTitleDisplayMode(.large)
        .toolbar { WearBloomToolbar() }
        .fullScreenCover(item: $selectedVariant) { variant in
            NavigationStack {
                ResultView(variant: variant).environment(session)
            }
        }
        .onAppear { Telemetry.event("screen_viewed", properties: ["screen": "saved_looks"]) }
    }
}

private struct LookCard: View {
    let look: Look
    let open: (RenderVariant) -> Void
    let edit: () -> Void

    private var latest: RenderVariant? {
        look.variants
            .filter { $0.state == .ready }
            .max { $0.createdAt < $1.createdAt }
    }

    var body: some View {
        Button {
            if let latest { open(latest) } else { edit() }
        } label: {
            VStack(alignment: .leading, spacing: 9) {
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
                .frame(height: 230)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 20).stroke(BloomColor.line, lineWidth: 1)
                }

                Text(look.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(BloomColor.ink)
                    .lineLimit(1)
                Text(look.variants.isEmpty ? "Saved outfit" : "\(look.variants.count) preview\(look.variants.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundStyle(BloomColor.muted)
            }
        }
        .buttonStyle(.plain)
    }
}

struct ResultView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Bindable var variant: RenderVariant
    @State private var savedToPhotos = false
    @State private var isPlannerPresented = false

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
        .sheet(isPresented: $isPlannerPresented) {
            if let look = variant.look { ResultPlannerSheet(look: look) }
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
                if let data = variant.resultData, let image = UIImage(data: data) {
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
                Button(savedToPhotos ? "Saved" : "Save photo", systemImage: savedToPhotos ? "checkmark" : "arrow.down") {
                    saveToPhotos()
                }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
            }

            Button("Plan this look", systemImage: "calendar.badge.plus") {
                isPlannerPresented = true
            }
            .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
            .disabled(variant.look == nil)

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
            isGeneratedReference: true
        )
        modelContext.insert(photo)
        try? modelContext.save()
        Telemetry.event("generated_reference_created")
        session.showToast(String(localized: "Added as a generated reference."))
    }

    private func submitFeedbackIfComplete() {
        guard let looksLikeMe = variant.feedbackLooksLikeMe,
              let helpful = variant.feedbackHelpful else { return }
        try? modelContext.save()
        Telemetry.event("render_feedback_submitted", properties: [
            "looks_like_me": looksLikeMe,
            "helpful": helpful,
            "mode": variant.isPreviewSimulation ? "on_device_preview" : "remote"
        ])
        guard let remoteRenderID = variant.remoteRenderID else { return }
        Task {
            do {
                try await WearBloomAPI.shared.sendFeedback(
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

private struct ResultPlannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    let look: Look
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: .now) ?? .now

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 24) {
                ZStack {
                    BloomColor.softBlue
                    HStack(spacing: -14) {
                        ForEach(look.garments.prefix(4)) { garment in
                            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                .frame(width: 115, height: 170)
                                .rotationEffect(.degrees(garment.id.hashValue.isMultiple(of: 2) ? -3 : 3))
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 260)
                .clipShape(RoundedRectangle(cornerRadius: 30))
                .overlay(RoundedRectangle(cornerRadius: 30).stroke(BloomColor.ink, lineWidth: 1.5))

                VStack(alignment: .leading, spacing: 8) {
                    Text("When will you wear it?")
                        .font(.system(size: 25, weight: .black, design: .rounded))
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .tint(BloomColor.blue)
                }

                Spacer()
                Button("Add to Today", systemImage: "calendar.badge.checkmark") { plan() }
                    .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
            }
            .padding(18)
            .background(BloomColor.cream)
            .navigationTitle("Plan this look")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func plan() {
        modelContext.insert(WearEvent(date: date, isPlanned: true, look: look, garments: look.garments))
        look.plannedDate = date
        try? modelContext.save()
        Telemetry.event("result_look_planned", properties: ["piece_count": look.garments.count])
        dismiss()
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
