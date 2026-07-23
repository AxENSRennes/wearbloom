import SwiftUI

struct CreateOutfitBoard: View {
    @Environment(AppSession.self) private var session
    let garments: [Garment]
    let selectedGarments: [Garment]
    let selectedReference: ReferencePhoto?
    @Binding var activeCategory: GarmentCategory?
    @Binding var pickingCategory: GarmentCategory?
    @Binding var isReferencePickerPresented: Bool

    private var boardHeight: CGFloat { selectedGarments.isEmpty ? 330 : 410 }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(BloomColor.paper.opacity(0.9))
            OrganicBlob()
                .fill(BloomColor.blue)
                .frame(width: 190, height: 180)
                .offset(x: 130, y: -boardHeight * 0.35)
            Circle()
                .fill(BloomColor.lime)
                .frame(width: 130)
                .offset(x: -145, y: boardHeight * 0.37)

            if selectedGarments.isEmpty {
                emptyState
            } else {
                selectedPieces
            }

            referencePicker
            controls
        }
        .frame(height: boardHeight)
        .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 34).stroke(BloomColor.ink, lineWidth: 2))
    }

    private var emptyState: some View {
        VStack(spacing: 9) {
            Image(systemName: "hanger")
                .font(.system(size: 38, weight: .medium))
            Text("Your outfit will come together here")
                .font(BloomTypography.bodyMedium)
            Text("Use the category buttons above to begin.")
                .font(BloomTypography.footnoteMedium)
                .foregroundStyle(BloomColor.muted)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 52)
        .offset(y: 24)
    }

    private var selectedPieces: some View {
        HStack(alignment: .center, spacing: -8) {
            ForEach(Array(selectedGarments.enumerated()), id: \.element.id) { index, garment in
                Button { withAnimation(.snappy) { activeCategory = garment.category } } label: {
                    ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                        .frame(
                            width: selectedGarments.count == 2 ? 165 : (index == 1 ? 155 : 135),
                            height: selectedGarments.count == 2 ? 275 : (index == 1 ? 245 : 210)
                        )
                        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 25))
                        .overlay {
                            RoundedRectangle(cornerRadius: 25)
                                .stroke(activeCategory == garment.category ? BloomColor.blue : .clear, lineWidth: 4)
                        }
                        .rotationEffect(.degrees(index.isMultiple(of: 2) ? -3 : 3))
                        .shadow(color: .black.opacity(0.09), radius: 14, y: 7)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var referencePicker: some View {
        Button { isReferencePickerPresented = true } label: {
            ZStack(alignment: .bottomTrailing) {
                ImageDataView(data: selectedReference?.imageData)
                    .frame(width: 90, height: 126)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(BloomColor.ink, lineWidth: 3))
                Image(systemName: "photo")
                    .font(.system(size: 12, weight: .black))
                    .frame(width: 28, height: 28)
                    .background(BloomColor.lime, in: Circle())
                    .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
                    .offset(x: 7, y: 7)
            }
        }
        .buttonStyle(.plain)
        .rotationEffect(.degrees(-4))
        .offset(x: -122, y: -boardHeight / 2 + 78)
        .accessibilityLabel(selectedReference == nil ? String(localized: "Add your photo") : String(localized: "Change your photo"))
    }

    private var controls: some View {
        VStack {
            Spacer()
            if let activeCategory,
               let garment = session.garment(for: activeCategory, in: garments) {
                HStack(spacing: 10) {
                    Text(garment.name)
                        .font(BloomTypography.footnoteMedium)
                        .lineLimit(1)
                    Spacer()
                    Button("Replace", systemImage: "arrow.triangle.2.circlepath") {
                        pickingCategory = activeCategory
                    }
                    .font(BloomTypography.footnoteMedium)
                    .foregroundStyle(BloomColor.blue)
                    Button("Remove", systemImage: "trash") {
                        session.remove(category: activeCategory)
                        self.activeCategory = nil
                    }
                    .font(BloomTypography.footnoteMedium)
                    .foregroundStyle(BloomColor.coral)
                }
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 1.4))
                .padding(14)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if !selectedGarments.isEmpty {
                Text("Tap a piece to replace or remove it")
                    .font(BloomTypography.captionMedium)
                    .padding(.horizontal, 14)
                    .frame(height: 34)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 14)
            }
        }
    }
}
