import Photos
import SwiftData
import SwiftUI

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
                    .font(BloomTypography.detailTitle)
                Spacer()
                if variant.isPreviewSimulation {
                    Text("Preview")
                        .font(BloomTypography.technical)
                        .padding(.horizontal, 10)
                        .frame(height: 28)
                        .background(BloomColor.softViolet, in: Capsule())
                        .foregroundStyle(BloomColor.violet)
                }
            }

            Text(variant.garmentSnapshot)
                .font(BloomTypography.subheadline)
                .foregroundStyle(BloomColor.muted)
                .lineLimit(2)

            VStack(spacing: 16) {
                HStack {
                    Text("Looks like you?")
                        .font(BloomTypography.subheadlineMedium)
                    Spacer()
                    FeedbackControl(value: $variant.feedbackLooksLikeMe)
                        .frame(width: 180)
                }
                HStack {
                    Text("Helpful?")
                        .font(BloomTypography.subheadlineMedium)
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
            .font(BloomTypography.caption)
            .foregroundStyle(BloomColor.muted)

            Button("Use as a reference photo", systemImage: "person.crop.rectangle.stack") {
                reuseAsReference()
            }
            .font(BloomTypography.subheadlineMedium)
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
            .font(BloomTypography.captionMedium)
            .frame(maxWidth: .infinity)
            .frame(height: 38)
            .background(selected ? BloomColor.softViolet : BloomColor.paper, in: Capsule())
            .foregroundStyle(selected ? BloomColor.violet : BloomColor.muted)
            .overlay(Capsule().stroke(selected ? BloomColor.violet.opacity(0.35) : BloomColor.line, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}
