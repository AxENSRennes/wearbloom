import PhotosUI
import SwiftData
import SwiftUI

struct ClosetView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Garment.createdAt, order: .reverse) private var garments: [Garment]
    @State private var category: GarmentCategory?
    @State private var isAddingGarment = false
    @State private var editingGarment: Garment?

    private var filtered: [Garment] {
        category.map { selected in garments.filter { $0.category == selected } } ?? garments
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                categoryPicker
                if filtered.isEmpty {
                    emptyState
                } else {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 22) {
                        ForEach(filtered) { garment in
                            Button { editingGarment = garment } label: {
                                GarmentCard(garment: garment)
                            }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button {
                                        garment.isFavorite.toggle()
                                    } label: {
                                        Label(garment.isFavorite ? "Remove favorite" : "Favorite", systemImage: "heart")
                                    }
                                    Button("Delete", systemImage: "trash", role: .destructive) {
                                        let id = garment.id
                                        modelContext.delete(garment)
                                        Task {
                                            do { try await WearBloomAPI.shared.deleteGarment(id) }
                                            catch { Telemetry.error(error, context: ["operation": "garment_delete"]) }
                                        }
                                    }
                                }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 28)
        }
        .background(BloomColor.cream)
        .navigationTitle("Closet")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { isAddingGarment = true } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add a piece")
            }
            WearBloomToolbar()
        }
        .sheet(isPresented: $isAddingGarment) {
            AddGarmentView()
        }
        .sheet(item: $editingGarment) { garment in
            EditGarmentView(garment: garment)
        }
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                FilterPill(title: String(localized: "All"), selected: category == nil) { category = nil }
                ForEach(GarmentCategory.allCases) { item in
                    FilterPill(title: item.title, selected: category == item) { category = item }
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No pieces yet", systemImage: "tshirt")
        } description: {
            Text("Add a garment to start your closet.")
        } actions: {
            Button("Add a piece") { isAddingGarment = true }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.violet, compact: true))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
}

struct GarmentCard: View {
    let garment: Garment

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ImageDataView(data: garment.imageData, fallback: garment.category.symbol)
                .frame(height: 205)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 20).stroke(BloomColor.line, lineWidth: 1)
                }
                .overlay(alignment: .topTrailing) {
                    if garment.isFavorite {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 13, weight: .bold))
                            .padding(8)
                            .background(.ultraThinMaterial, in: Circle())
                            .foregroundStyle(BloomColor.coral)
                            .padding(8)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(garment.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(2)
                Text(garment.category.title)
                    .font(.caption)
                    .foregroundStyle(BloomColor.muted)
            }
        }
    }
}

private struct FilterPill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 14, weight: .medium))
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(selected ? BloomColor.ink : BloomColor.paper, in: Capsule())
                .foregroundStyle(selected ? Color.white : BloomColor.muted)
                .overlay(Capsule().stroke(BloomColor.line, lineWidth: 1))
        }
    }
}

struct AddGarmentView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @State private var name = ""
    @State private var category = GarmentCategory.top
    @State private var photoItem: PhotosPickerItem?
    @State private var imageData: Data?
    @State private var originalImageData: Data?
    @State private var isCameraPresented = false
    @State private var isCleaningBackground = false
    @State private var isDetectingCategory = false
    @State private var remoteAssetID: UUID?
    @State private var detectionConfidence: Double?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24).fill(BloomColor.cream)
                        ImageDataView(data: imageData, contentMode: .fit, fallback: "hanger")
                    }
                    .frame(height: 245)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    HStack {
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            Label("Choose photo", systemImage: "photo.on.rectangle")
                        }
                        Spacer()
                        Button("Camera", systemImage: "camera") { isCameraPresented = true }
                    }
                    if isCleaningBackground {
                        Label("Cleaning the background on this device…", systemImage: "wand.and.stars")
                            .font(.caption)
                            .foregroundStyle(BloomColor.violet)
                    }
                }
                Section("Details") {
                    TextField("Piece name", text: $name)
                    Picker("Category", selection: $category) {
                        ForEach(GarmentCategory.allCases) { item in Text(item.title).tag(item) }
                    }
                    if isDetectingCategory {
                        Label("Finding the category…", systemImage: "sparkles")
                            .font(.caption)
                            .foregroundStyle(BloomColor.violet)
                    } else if let detectionConfidence {
                        Text("Suggested with \(detectionConfidence.formatted(.percent.precision(.fractionLength(0)))) confidence")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .tint(BloomColor.violet)
            .navigationTitle("Add a piece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.bold)
                        .disabled(imageData == nil)
                }
            }
            .onChange(of: photoItem) { _, item in
                Task {
                    guard let data = try? await item?.loadTransferable(type: Data.self) else { return }
                    await prepare(data)
                }
            }
            .fullScreenCover(isPresented: $isCameraPresented) {
                CameraPicker { data in Task { await prepare(data) } }
                    .ignoresSafeArea()
            }
        }
    }

    private func save() {
        let defaultName = String(localized: "New \(category.title.lowercased())")
        modelContext.insert(Garment(
            name: name.isEmpty ? defaultName : name,
            category: category,
            imageData: imageData,
            originalImageData: originalImageData,
            remoteAssetID: remoteAssetID
        ))
        try? modelContext.save()
        Telemetry.event("garment_added", properties: ["category": category.rawValue])
        dismiss()
    }

    @MainActor
    private func prepare(_ data: Data) async {
        originalImageData = data
        imageData = data
        isCleaningBackground = true
        imageData = await GarmentImageProcessor.shared.cleanBackground(from: data)
        isCleaningBackground = false
        guard await WearBloomAPI.shared.isConfigured, session.hasAIProcessingConsent else { return }
        isDetectingCategory = true
        do {
            let detection = try await WearBloomAPI.shared.detectGarment(data: data)
            category = detection.category
            remoteAssetID = detection.assetID
            detectionConfidence = detection.confidence
            Telemetry.event("garment_category_detected", properties: [
                "category": detection.category.rawValue,
                "confidence_bucket": Int(detection.confidence * 10) * 10
            ])
        } catch {
            Telemetry.error(error, context: ["operation": "garment_detection"])
        }
        isDetectingCategory = false
    }
}

private struct EditGarmentView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var garment: Garment

    var body: some View {
        NavigationStack {
            Form {
                ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                TextField("Name", text: $garment.name)
                Picker("Category", selection: $garment.categoryRawValue) {
                    ForEach(GarmentCategory.allCases) { Text($0.title).tag($0.rawValue) }
                }
                Toggle("Favorite", isOn: $garment.isFavorite)
            }
            .navigationTitle("Edit piece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
