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
                        .font(BloomTypography.subheadlineMedium)
                        .foregroundStyle(BloomColor.ink)
                        .lineLimit(1)
                    Text(look.variants.isEmpty
                        ? String(localized: "Saved outfit")
                        : String(localized: "\(look.variants.count) previews"))
                        .font(BloomTypography.technical)
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
                        .font(BloomTypography.subheadline)
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
                                                    .font(BloomTypography.technical)
                                                    .foregroundStyle(.white)
                                            }
                                        }
                                    }
                                    .frame(height: 225)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 20))
                                    Text("Variant \(variant.sequence)")
                                        .font(BloomTypography.technicalEmphasis)
                                        .foregroundStyle(BloomColor.ink)
                                    Text(variant.createdAt, format: .dateTime.month(.abbreviated).day().year())
                                        .font(BloomTypography.technical)
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
