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
            VStack(alignment: .leading, spacing: 20) {
                header
                compositionCard
                garmentSlots
                actionRow
                trustLine
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 28)
        }
        .background(BloomColor.cream)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { WearBloomToolbar() }
        .sheet(item: $pickingCategory) { category in
            GarmentPickerView(category: category)
        }
        .sheet(isPresented: $isReferencePickerPresented) {
            ReferencePickerView()
        }
        .fullScreenCover(isPresented: $isRenderingPresented) {
            RenderProgressView()
                .environment(session)
        }
        .fullScreenCover(item: $resultVariant) { variant in
            NavigationStack {
                ResultView(variant: variant)
                    .environment(session)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                SectionEyebrow(text: session.activeLookID == nil ? "NEW COMPOSITION" : "EDITING A SAVED LOOK")
                Spacer()
                if session.activeLookID != nil {
                    Button("Start fresh") { session.resetDraft() }
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                }
            }
            Text(selectedGarments.isEmpty ? "Let’s make\nsomething bold." : "Your look is\ntaking shape.")
                .font(.system(size: 39, weight: .black, design: .serif))
                .tracking(-1.8)
                .lineSpacing(-5)
            Text("One photo, a few pieces, and a personal preview without the second-guessing.")
                .font(.system(size: 14, design: .rounded))
                .foregroundStyle(BloomColor.muted)
        }
        .padding(.top, 18)
    }

    private var compositionCard: some View {
        ZStack {
            OrganicBlob().fill(BloomColor.violet).scaleEffect(1.25).offset(x: 135, y: -80)
            OrganicBlob().fill(BloomColor.coral).frame(width: 220, height: 220).offset(x: -140, y: 145)

            if let reference = selectedReference {
                Button { isReferencePickerPresented = true } label: {
                    ZStack(alignment: .bottomLeading) {
                        ImageDataView(data: reference.imageData)
                            .frame(width: 154, height: 245)
                            .clipped()
                        Text(reference.isGeneratedReference ? "GENERATED REF" : "MY PHOTO ✓")
                            .font(.system(size: 8, weight: .bold, design: .monospaced))
                            .padding(.horizontal, 9).padding(.vertical, 7)
                            .background(BloomColor.lime, in: Capsule())
                            .foregroundStyle(BloomColor.ink)
                            .padding(9)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 26).stroke(BloomColor.ink, lineWidth: 2))
                    .rotationEffect(.degrees(-3))
                }
                .buttonStyle(.plain)
                .offset(x: -86, y: -16)
            } else {
                Button { isReferencePickerPresented = true } label: {
                    VStack(spacing: 10) {
                        Image(systemName: "person.crop.rectangle.badge.plus").font(.system(size: 32))
                        Text("Add your photo").fontWeight(.bold)
                    }
                    .frame(width: 154, height: 245)
                    .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 26))
                    .overlay(RoundedRectangle(cornerRadius: 26).stroke(BloomColor.ink, style: StrokeStyle(lineWidth: 2, dash: [7])))
                }
                .foregroundStyle(BloomColor.ink)
                .offset(x: -86, y: -16)
            }

            VStack(spacing: -9) {
                ForEach(Array(selectedGarments.prefix(3).enumerated()), id: \.element.id) { index, garment in
                    MiniGarmentCard(garment: garment)
                        .rotationEffect(.degrees(index.isMultiple(of: 2) ? 5 : -4))
                }
                if selectedGarments.isEmpty {
                    Button { pickingCategory = .top } label: {
                        VStack(spacing: 8) {
                            Image(systemName: "plus").font(.system(size: 28, weight: .medium))
                            Text("ADD PIECE").font(.system(size: 9, weight: .bold, design: .monospaced))
                        }
                        .frame(width: 126, height: 130)
                        .background(BloomColor.lime, in: RoundedRectangle(cornerRadius: 24))
                        .foregroundStyle(BloomColor.ink)
                        .overlay(RoundedRectangle(cornerRadius: 24).stroke(BloomColor.ink, lineWidth: 2))
                    }
                }
            }
            .offset(x: 90, y: -5)

            HStack {
                Text("\(selectedGarments.count) PIECE\(selectedGarments.count == 1 ? "" : "S")")
                Spacer()
                Button { pickingCategory = .outerwear } label: { Label("Add", systemImage: "plus") }
            }
            .font(.system(size: 9, weight: .bold, design: .monospaced))
            .foregroundStyle(.white)
            .padding(.horizontal, 17)
            .offset(y: 165)
        }
        .frame(height: 375)
        .clipShape(RoundedRectangle(cornerRadius: 31, style: .continuous))
        .background(BloomColor.ink, in: RoundedRectangle(cornerRadius: 31).offset(x: 6, y: 6))
        .overlay(RoundedRectangle(cornerRadius: 31).stroke(BloomColor.ink, lineWidth: 2))
    }

    private var garmentSlots: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionEyebrow(text: "BUILD THE LOOK")
                Spacer()
                Text("One per category")
                    .font(.system(size: 11, design: .rounded))
                    .foregroundStyle(BloomColor.muted)
            }
            if session.selectedGarmentIDs[.dress] != nil {
                HStack(spacing: 10) {
                    slot(for: .dress)
                    slot(for: .outerwear)
                }
            } else {
                HStack(spacing: 10) {
                    slot(for: .top)
                    slot(for: .bottom)
                    slot(for: .outerwear)
                }
                Button("Choose a dress instead") { pickingCategory = .dress }
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(BloomColor.violet)
            }
        }
    }

    private func slot(for category: GarmentCategory) -> some View {
        let garment = session.garment(for: category, in: garments)
        return Button { pickingCategory = category } label: {
            VStack(spacing: 7) {
                if let garment {
                    ImageDataView(data: garment.imageData, fallback: category.symbol)
                        .frame(height: 75).clipped()
                } else {
                    Image(systemName: category.symbol)
                        .font(.system(size: 23, weight: .medium))
                        .frame(height: 75)
                        .foregroundStyle(BloomColor.violet)
                }
                Text(garment?.name ?? category.prompt)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(BloomColor.ink)
                    .lineLimit(1)
                    .padding(.horizontal, 5)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 8)
            .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(BloomColor.ink.opacity(0.7), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .contextMenu {
            if garment != nil {
                Button("Remove from look", systemImage: "xmark") { session.remove(category: category) }
            }
        }
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
            Button("Save for later") { saveDraft() }
                .buttonStyle(BloomOutlineButtonStyle())
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
                HStack { Text("Show me"); Image(systemName: "sparkles") }
            }
            .buttonStyle(BloomButtonStyle())
            .disabled(!canRender)
            .opacity(canRender ? 1 : 0.48)
        }
    }

    private var trustLine: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.fill")
            Text("PRIVATE BY DEFAULT / FAILED RENDERS NEVER COUNT")
        }
        .font(.system(size: 9, weight: .bold, design: .monospaced))
        .foregroundStyle(BloomColor.muted)
        .frame(maxWidth: .infinity)
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

private struct MiniGarmentCard: View {
    let garment: Garment

    var body: some View {
        VStack(spacing: 4) {
            ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                .frame(width: 122, height: 92).clipped()
            Text(garment.name.uppercased())
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .lineLimit(1)
                .padding(.horizontal, 8).padding(.bottom, 7)
        }
        .frame(width: 126)
        .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(BloomColor.ink, lineWidth: 2))
        .shadow(color: BloomColor.ink, radius: 0, x: 4, y: 4)
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
                        "No \(category.title.lowercased()) pieces yet",
                        systemImage: category.symbol,
                        description: Text("Add one from the Closet tab, then it will appear here.")
                    )
                    .padding(.top, 70)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                        ForEach(options) { garment in
                            Button {
                                session.select(garment)
                                dismiss()
                            } label: {
                                GarmentCard(garment: garment)
                                    .overlay {
                                        if session.selectedGarmentIDs[category] == garment.id {
                                            RoundedRectangle(cornerRadius: 20).stroke(BloomColor.violet, lineWidth: 5)
                                        }
                                    }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(18)
                }
            }
            .background(BloomColor.cream)
            .navigationTitle("Choose \(category.title.lowercased())")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
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
                            Label("Photos", systemImage: "photo.on.rectangle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(BloomOutlineButtonStyle())
                        Button { isCameraPresented = true } label: {
                            Label("Camera", systemImage: "camera")
                        }
                        .buttonStyle(BloomOutlineButtonStyle())
                    }
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                        ForEach(references) { photo in
                            Button {
                                session.selectedReferenceID = photo.id
                                dismiss()
                            } label: {
                                ZStack(alignment: .bottomLeading) {
                                    ImageDataView(data: photo.imageData).frame(height: 230).clipped()
                                    Text(photo.isGeneratedReference ? "GENERATED REFERENCE" : photo.isDefault ? "DEFAULT" : "REFERENCE")
                                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                                        .padding(7).background(BloomColor.lime, in: Capsule()).padding(8)
                                }
                                .clipShape(RoundedRectangle(cornerRadius: 20))
                                .overlay(RoundedRectangle(cornerRadius: 20).stroke(session.selectedReferenceID == photo.id ? BloomColor.violet : BloomColor.ink, lineWidth: session.selectedReferenceID == photo.id ? 4 : 1.5))
                            }
                            .foregroundStyle(BloomColor.ink)
                        }
                    }
                }
                .padding(18)
            }
            .background(BloomColor.cream)
            .navigationTitle("Your references")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
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
        let photo = ReferencePhoto(name: String(localized: "Reference \(references.count + 1)"), imageData: data, isDefault: true)
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
            BloomColor.violet.ignoresSafeArea()
            OrganicBlob().fill(BloomColor.lime).frame(width: 430, height: 430).offset(x: -130, y: -250).rotationEffect(.degrees(20))
            OrganicBlob().fill(BloomColor.coral).frame(width: 330, height: 330).offset(x: 170, y: 330)
            VStack(spacing: 26) {
                Spacer()
                ZStack {
                    Circle().stroke(.white.opacity(0.18), lineWidth: 16)
                    Circle()
                        .trim(from: 0, to: max(session.renderProgress, 0.03))
                        .stroke(BloomColor.lime, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: "sparkles")
                        .font(.system(size: 50, weight: .bold))
                        .foregroundStyle(.white)
                }
                .frame(width: 190, height: 190)
                Text("\(Int(session.renderProgress * 100))%")
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(BloomColor.lime)
                Text(session.renderMessage)
                    .font(.system(size: 34, weight: .black, design: .serif))
                    .tracking(-1.2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                Text("A preview can take a little while. You can leave this screen; the look will keep rendering.")
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.72))
                    .padding(.horizontal, 34)
                Spacer()
                Button("Keep browsing") { dismiss() }
                    .buttonStyle(BloomButtonStyle(fill: BloomColor.lime))
                    .padding(.horizontal, 24)
                Text("FAILED RENDERS NEVER USE A GENERATION")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.62))
            }
            .padding(.bottom, 20)
        }
    }
}
