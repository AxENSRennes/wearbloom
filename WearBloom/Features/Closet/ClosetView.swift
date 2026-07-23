import PhotosUI
import SwiftData
import SwiftUI

struct ClosetView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(filter: #Predicate<Garment> { !$0.isArchived }, sort: \Garment.createdAt, order: .reverse)
    private var garments: [Garment]
    @State private var category: GarmentCategory?
    @State private var isAddingGarment = false
    @State private var editingGarment: Garment?
    @State private var query = ""
    @State private var showFavoritesOnly = false

    private var filtered: [Garment] {
        garments.filter { garment in
            (category == nil || garment.category == category)
                && (!showFavoritesOnly || garment.isFavorite)
                && (query.isEmpty || garment.name.localizedStandardContains(query))
        }
    }

    private var selected: [Garment] {
        garments.filter { session.selectedGarmentIDs.values.contains($0.id) }
    }

    var body: some View {
        BloomPageScaffold(
            title: String(localized: "Closet"),
            contentSpacing: 16,
            bottomPadding: selected.isEmpty ? 132 : 224
        ) {
            session.isProfilePresented = true
        } content: {
            HStack(spacing: 14) {
                Label {
                    TextField("Search your closet", text: $query)
                } icon: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(BloomColor.muted)
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(BloomColor.paper, in: Capsule())
                .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 1.25))

                Button { isAddingGarment = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .black))
                        .foregroundStyle(.white)
                        .frame(width: 46, height: 46)
                        .background(BloomColor.blue, in: Circle())
                        .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
                }
                .accessibilityLabel("Add a piece")
            }

            categoryPicker

            if filtered.isEmpty {
                emptyState
            } else {
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible())], spacing: 16) {
                    ForEach(filtered) { garment in
                        let isSelected = session.selectedGarmentIDs.values.contains(garment.id)
                        Button { toggle(garment) } label: {
                            GarmentCard(garment: garment, isSelected: isSelected)
                        }
                        .buttonStyle(GarmentCardButtonStyle())
                        .sensoryFeedback(.selection, trigger: isSelected)
                        .accessibilityLabel("\(garment.name), \(garment.category.title)")
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                        .contextMenu {
                            Button("View details", systemImage: "info.circle") { editingGarment = garment }
                            Button {
                                garment.isFavorite.toggle()
                            } label: {
                                Label(
                                    garment.isFavorite ? String(localized: "Remove favorite") : String(localized: "Favorite"),
                                    systemImage: "heart"
                                )
                            }
                            Button("Archive", systemImage: "archivebox") { garment.isArchived = true }
                            Button("Delete", systemImage: "trash", role: .destructive) {
                                delete(garment)
                            }
                        }
                    }
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if !selected.isEmpty {
                selectionTray
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $isAddingGarment) {
            AddGarmentView()
        }
        .sheet(item: $editingGarment) { garment in
            EditGarmentView(garment: garment)
        }
        .onAppear { Telemetry.event("screen_viewed", properties: ["screen": "closet"]) }
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                FilterPill(title: String(localized: "All"), selected: category == nil) { category = nil }
                ForEach(GarmentCategory.allCases) { item in
                    FilterPill(title: item.title, selected: category == item) { category = item }
                }
                FilterPill(title: String(localized: "Favorites"), selected: showFavoritesOnly) {
                    showFavoritesOnly.toggle()
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
        .accessibilityIdentifier("closet-category-carousel")
    }

    private var selectionTray: some View {
        VStack(spacing: 12) {
            HStack {
                HStack(spacing: -7) {
                    ForEach(selected.prefix(4)) { garment in
                        Button { session.remove(category: garment.category) } label: {
                            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                                .frame(width: 38, height: 48)
                                .background(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(RoundedRectangle(cornerRadius: 12).stroke(BloomColor.ink, lineWidth: 1.4))
                                .overlay(alignment: .topTrailing) {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .black))
                                        .frame(width: 16, height: 16)
                                        .background(BloomColor.ink, in: Circle())
                                        .foregroundStyle(.white)
                                        .offset(x: 3, y: -3)
                                }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove \(garment.name) from outfit")
                    }
                }
                Text("\(selected.count) selected")
                    .font(BloomTypography.technicalEmphasis)
                Spacer()
                Button("Clear") { withAnimation(.snappy) { session.resetDraft() } }
                    .font(BloomTypography.footnoteMedium)
                    .foregroundStyle(BloomColor.muted)
            }
            Button {
                session.selectedTab = 1
                Telemetry.event("closet_selection_completed", properties: ["piece_count": selected.count])
            } label: {
                HStack {
                    Text("Build outfit")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
            }
            .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(.ultraThinMaterial)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No pieces yet", systemImage: "tshirt")
        } description: {
            Text("Add a garment to start your closet.")
        } actions: {
            Button("Add a piece") { isAddingGarment = true }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.blue, compact: true))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    private func toggle(_ garment: Garment) {
        withAnimation(.snappy) {
            if session.selectedGarmentIDs[garment.category] == garment.id {
                session.remove(category: garment.category)
            } else {
                session.select(garment)
            }
        }
    }

    private func delete(_ garment: Garment) {
        let id = garment.id
        SynchronizedDeletion.perform(
            operation: "garment_delete",
            remote: { try await RemoteLibraryCoordinator.shared.deleteGarment(id) },
            local: {
                modelContext.delete(garment)
                try modelContext.saveIfNeeded()
            },
            onFailure: { session.showToast(String(localized: "Couldn’t delete this garment. Please try again.")) }
        )
    }
}

struct GarmentCard: View {
    let garment: Garment
    var isSelected = false

    private let imageCornerRadius: CGFloat = 20

    private var garmentColor: Color {
        Color(hex: garment.colorHex)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ZStack {
                RoundedRectangle(cornerRadius: imageCornerRadius, style: .continuous)
                    .fill(isSelected ? BloomColor.coral.opacity(0.8) : garmentColor.opacity(0.12))
                    .offset(y: isSelected ? 5 : 3)

                ZStack {
                    BloomColor.paper
                    garmentColor.opacity(isSelected ? 0.1 : 0.06)
                    ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                        .padding(7)
                }
                .clipShape(RoundedRectangle(cornerRadius: imageCornerRadius, style: .continuous))
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(0.84, contentMode: .fit)
            .overlay {
                RoundedRectangle(cornerRadius: imageCornerRadius, style: .continuous)
                    .stroke(
                        isSelected ? BloomColor.blue : BloomColor.ink.opacity(0.09),
                        lineWidth: isSelected ? 2 : 1
                    )
            }
            .overlay(alignment: .topLeading) {
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(BloomColor.ink)
                        .frame(width: 30, height: 30)
                        .background(BloomColor.lime, in: Circle())
                        .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.25))
                        .padding(9)
                        .transition(.scale.combined(with: .opacity))
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .topTrailing) {
                if garment.isFavorite {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(BloomColor.coral)
                        .frame(width: 30, height: 30)
                        .background(BloomColor.paper.opacity(0.96), in: Circle())
                        .padding(9)
                        .accessibilityHidden(true)
                }
            }
            .shadow(
                color: isSelected ? BloomColor.blue.opacity(0.18) : .black.opacity(0.055),
                radius: isSelected ? 12 : 8,
                y: isSelected ? 7 : 4
            )

            VStack(alignment: .leading, spacing: 4) {
                Text(garment.name)
                    .font(BloomTypography.subheadlineMedium)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, minHeight: 36, alignment: .topLeading)

                HStack(spacing: 6) {
                    Capsule()
                        .fill(garmentColor)
                        .frame(width: 13, height: 4)
                    Text(garment.category.title.uppercased())
                        .font(BloomTypography.technicalSmall)
                        .foregroundStyle(BloomColor.muted)
                }
            }
            .padding(.horizontal, 4)
        }
        .contentShape(Rectangle())
    }
}

private struct GarmentCardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.975 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.snappy(duration: 0.16), value: configuration.isPressed)
    }
}

private struct FilterPill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BloomPill(title: title, selected: selected)
        }
        .buttonStyle(.plain)
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
                            .font(BloomTypography.caption)
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
                            .font(BloomTypography.caption)
                            .foregroundStyle(BloomColor.violet)
                    } else if let detectionConfidence {
                        Text("Suggested with \(detectionConfidence.formatted(.percent.precision(.fractionLength(0)))) confidence")
                            .font(BloomTypography.caption)
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
                        .font(BloomTypography.subheadlineMedium)
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
        guard modelContext.saveReporting(operation: "garment_save") else {
            modelContext.rollback()
            session.showToast(String(localized: "Couldn’t save this garment. Please try again."))
            return
        }
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
        guard await RemoteLibraryCoordinator.shared.isConfigured, session.hasAIProcessingConsent else { return }
        isDetectingCategory = true
        do {
            let detection = try await RemoteLibraryCoordinator.shared.detectGarment(data: data)
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
