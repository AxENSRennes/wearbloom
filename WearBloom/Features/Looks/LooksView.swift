import Photos
import RevenueCatUI
import SwiftData
import SwiftUI

struct LooksView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Look.updatedAt, order: .reverse) private var looks: [Look]
    @State private var selectedVariant: RenderVariant?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 22) {
                header
                if looks.isEmpty {
                    emptyState
                } else {
                    ForEach(looks) { look in
                        LookRow(look: look) { selectedVariant = $0 }
                            .contextMenu {
                                Button("Edit composition", systemImage: "slider.horizontal.3") { session.load(look) }
                                Button("Delete look", systemImage: "trash", role: .destructive) {
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
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 32)
        }
        .background(BloomColor.cream)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { WearBloomToolbar() }
        .fullScreenCover(item: $selectedVariant) { variant in
            NavigationStack {
                ResultView(variant: variant)
                    .environment(session)
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            SectionEyebrow(text: "COMPOSITIONS / \(looks.count)")
            Text("Looks worth\ncoming back to.")
                .font(.system(size: 38, weight: .black, design: .serif))
                .tracking(-1.7)
                .lineSpacing(-4)
            Text("Every render stays as its own variant, even when you edit the pieces.")
                .font(.system(size: 14, design: .rounded))
                .foregroundStyle(BloomColor.muted)
        }
        .padding(.top, 18)
    }

    private var emptyState: some View {
        VStack(spacing: 15) {
            Image(systemName: "sparkles.rectangle.stack")
                .font(.system(size: 50, weight: .light))
                .foregroundStyle(BloomColor.violet)
            Text("Your looks land here")
                .font(.system(size: 22, weight: .black, design: .serif))
            Text("Compose your first outfit in Create. Save it before rendering or keep it after the reveal.")
                .multilineTextAlignment(.center)
                .foregroundStyle(BloomColor.muted)
            Button("Create a look") { session.selectedTab = 1 }
                .buttonStyle(BloomButtonStyle())
        }
        .padding(34)
        .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 25))
        .bloomCard(radius: 25)
    }
}

private struct LookRow: View {
    let look: Look
    let open: (RenderVariant) -> Void

    private var readyVariants: [RenderVariant] {
        look.variants.filter { $0.state == .ready }.sorted { $0.createdAt > $1.createdAt }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(look.name)
                        .font(.system(size: 23, weight: .black, design: .serif))
                    Text("\(look.garments.count) PIECES • \(look.variants.count) VARIANT\(look.variants.count == 1 ? "" : "S")")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(BloomColor.muted)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(BloomColor.violet)
            }
            if let latest = readyVariants.first {
                Button { open(latest) } label: {
                    ZStack(alignment: .bottomLeading) {
                        ImageDataView(data: latest.resultData)
                            .frame(height: 305).clipped()
                        LinearGradient(colors: [.clear, .black.opacity(0.75)], startPoint: .center, endPoint: .bottom)
                        HStack(alignment: .bottom) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("LATEST RESULT")
                                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                                Text("Variant \(latest.sequence)")
                                    .font(.system(size: 17, weight: .bold, design: .rounded))
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right").fontWeight(.bold)
                        }
                        .foregroundStyle(.white)
                        .padding(16)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 23))
                    .overlay(RoundedRectangle(cornerRadius: 23).stroke(BloomColor.ink, lineWidth: 2))
                }
                .buttonStyle(.plain)
            } else {
                HStack(spacing: 10) {
                    ForEach(look.garments.prefix(3)) { garment in
                        ImageDataView(data: garment.imageData, fallback: garment.category.symbol)
                            .frame(maxWidth: .infinity).frame(height: 118).clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 17))
                    }
                }
            }
        }
        .padding(14)
        .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 27))
        .bloomCard(radius: 27)
        .padding(.trailing, 5)
        .padding(.bottom, 5)
    }
}

struct ResultView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Bindable var variant: RenderVariant
    @State private var savedToPhotos = false

    var body: some View {
        ZStack {
            BloomColor.violet.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 0) {
                    resultImage
                    verdict
                        .offset(y: -42)
                }
                .padding(.bottom, 45)
            }
            .scrollIndicators(.hidden)
        }
        .toolbar(.hidden, for: .navigationBar)
        .safeAreaInset(edge: .top) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark").frame(width: 42, height: 42)
                        .background(.white, in: Circle())
                        .overlay(Circle().stroke(BloomColor.ink, lineWidth: 2))
                }
                Spacer()
                Text("LOOK \(variant.look?.name.replacingOccurrences(of: "Look ", with: "") ?? "—") / \(String(format: "%02d", variant.sequence))")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(BloomColor.coral, in: Capsule())
                    .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 2))
            }
            .foregroundStyle(BloomColor.ink)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 18)
            .padding(.top, 4)
        }
        .onAppear {
            Telemetry.event("render_revealed", properties: [
                "mode": variant.isPreviewSimulation ? "on_device_preview" : "remote",
                "sequence": variant.sequence
            ])
        }
        .onChange(of: variant.feedbackLooksLikeMe) { _, _ in submitFeedbackIfComplete() }
        .onChange(of: variant.feedbackHelpful) { _, _ in submitFeedbackIfComplete() }
    }

    private var resultImage: some View {
        ZStack(alignment: .topLeading) {
            ImageDataView(data: variant.resultData)
                .frame(height: 590).clipped()
            LinearGradient(colors: [.black.opacity(0.5), .clear], startPoint: .top, endPoint: .center)
            VStack(alignment: .leading, spacing: 8) {
                Text("This one\nhas energy.")
                    .font(.system(size: 42, weight: .black, design: .serif))
                    .tracking(-2)
                    .lineSpacing(-6)
                    .foregroundStyle(.white)
                if variant.isPreviewSimulation {
                    Text("ON-DEVICE PREVIEW")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(BloomColor.lime, in: Capsule())
                        .foregroundStyle(BloomColor.ink)
                }
            }
            .padding(.top, 30)
            .padding(.leading, 22)
        }
        .clipShape(RoundedRectangle(cornerRadius: 34))
        .overlay(RoundedRectangle(cornerRadius: 34).stroke(BloomColor.ink, lineWidth: 2))
        .shadow(color: BloomColor.ink, radius: 0, x: 7, y: 7)
        .padding(.horizontal, 14)
        .padding(.top, 12)
    }

    private var verdict: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("It feels like you — louder.")
                .font(.system(size: 25, weight: .black, design: .serif))
                .tracking(-0.7)
            Text(variant.isPreviewSimulation
                 ? "This private on-device composition proves the product flow. Connect the generation API for a photoreal personal render."
                 : "The composition keeps the outfit readable while bringing the pieces into one personal point of view.")
                .font(.system(size: 14, design: .rounded))
                .foregroundStyle(BloomColor.muted)
                .lineSpacing(2)
            Text(variant.garmentSnapshot)
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .foregroundStyle(BloomColor.violet)
            Divider().overlay(BloomColor.ink)
            Text("Does it look like you?")
                .font(.system(size: 14, weight: .bold, design: .rounded))
            FeedbackControl(value: $variant.feedbackLooksLikeMe)
            Text("Did it help you decide?")
                .font(.system(size: 14, weight: .bold, design: .rounded))
            FeedbackControl(value: $variant.feedbackHelpful)
            HStack(spacing: 10) {
                Button("Swap a piece") {
                    if let look = variant.look { session.load(look) }
                    dismiss()
                }
                .buttonStyle(BloomOutlineButtonStyle())
                if let data = variant.resultData, let image = UIImage(data: data) {
                    ShareLink(
                        item: Image(uiImage: image),
                        preview: SharePreview("My WearBloom look", image: Image(uiImage: image))
                    ) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(BloomButtonStyle())
                }
            }
            HStack {
                Button(savedToPhotos ? "Saved" : "Save image", systemImage: savedToPhotos ? "checkmark" : "square.and.arrow.down") {
                    saveToPhotos()
                }
                Spacer()
                Button("Use as reference", systemImage: "person.crop.rectangle.stack") {
                    reuseAsReference()
                }
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundStyle(BloomColor.violet)
        }
        .padding(20)
        .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 26))
        .bloomCard(radius: 26)
        .padding(.horizontal, 25)
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

private struct FeedbackControl: View {
    @Binding var value: Bool?

    var body: some View {
        HStack(spacing: 9) {
            Button { value = true } label: { Label("Yes", systemImage: "hand.thumbsup") }
                .buttonStyle(FeedbackButtonStyle(selected: value == true))
            Button { value = false } label: { Label("Not really", systemImage: "hand.thumbsdown") }
                .buttonStyle(FeedbackButtonStyle(selected: value == false))
        }
    }
}

private struct FeedbackButtonStyle: ButtonStyle {
    let selected: Bool
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .frame(maxWidth: .infinity).frame(height: 40)
            .background(selected ? BloomColor.lime : BloomColor.cream, in: RoundedRectangle(cornerRadius: 13))
            .overlay(RoundedRectangle(cornerRadius: 13).stroke(BloomColor.ink, lineWidth: selected ? 2 : 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
