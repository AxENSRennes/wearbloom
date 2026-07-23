import PhotosUI
import SwiftData
import SwiftUI

struct TryOnPrepView: View {
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
                                Label(currentReference == nil ? String(localized: "Add photo") : String(localized: "Change photo"), systemImage: "photo")
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

struct GarmentPickerView: View {
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

struct ReferencePickerView: View {
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
                                            Text(photo.isGeneratedReference ? String(localized: "Generated") : String(localized: "Default"))
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
        guard modelContext.saveReporting(operation: "reference_save") else {
            modelContext.rollback()
            session.showToast(String(localized: "Couldn’t save this reference. Please try again."))
            return
        }
        Telemetry.event("reference_added", properties: ["source": "photo_library_or_camera"])
        session.selectedReferenceID = photo.id
    }
}

struct RenderProgressView: View {
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
