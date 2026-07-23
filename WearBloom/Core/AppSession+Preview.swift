import SwiftData
import SwiftUI
import UIKit

extension AppSession {
    func seedIfNeeded(context: ModelContext) throws {
#if !DEBUG
        // Production libraries always start from the user's own wardrobe.
        return
#else
        try seedGarmentsIfNeeded(context: context)
        try seedReferenceIfNeeded(context: context)
        try context.save()

#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-reviewSelection") {
            let allGarments = try context.fetch(FetchDescriptor<Garment>())
            if let top = allGarments.first(where: { $0.category == .top }) { select(top) }
            if let bottom = allGarments.first(where: { $0.category == .bottom }) { select(bottom) }
        }
#endif
#endif
    }

    private func seedGarmentsIfNeeded(context: ModelContext) throws {
        var descriptor = FetchDescriptor<Garment>()
        descriptor.fetchLimit = 1
        guard try context.fetch(descriptor).isEmpty else { return }
        let samples = [
            PreviewGarmentSeed("Plum gathered top", .top, "#7C3558", "tshirt.fill", "plum-blouse.png"),
            PreviewGarmentSeed("Orchid knit top", .top, "#BEB2D8", "tshirt.fill", "orchid-knit.png"),
            PreviewGarmentSeed("Black wide-leg trousers", .bottom, "#252525", "figure.stand.dress.line.vertical.figure", "black-trousers.jpg"),
            PreviewGarmentSeed("Cobalt overshirt", .outerwear, "#3038F2", "jacket.fill", "cobalt-overshirt.png"),
            PreviewGarmentSeed("Coral column dress", .dress, "#FF6D5B", "figure.dress.line.vertical.figure", "coral-dress.png"),
            PreviewGarmentSeed("Lime car coat", .outerwear, "#D9FF43", "jacket.fill", "lime-coat.png")
        ]
        let garments = samples.map { sample in
            let photoData = sample.assetName.flatMap(PreviewImageFactory.bundledData(named:))
            return Garment(
                name: sample.name,
                category: sample.category,
                imageData: photoData ?? PreviewImageFactory.garmentPoster(
                    color: UIColor(Color(hex: sample.hex)),
                    symbol: sample.symbol
                ),
                colorHex: sample.hex
            )
        }
        garments.forEach(context.insert)
        seedLook(from: garments, context: context)
    }

    private func seedLook(from garments: [Garment], context: ModelContext) {
        guard let top = garments.first(where: { $0.category == .top }),
              let bottom = garments.first(where: { $0.category == .bottom }) else { return }
        let look = Look(name: String(localized: "Easy contrast"), isFavorite: true, garments: [top, bottom])
        let variant = RenderVariant(
            sequence: 1,
            state: .ready,
            resultData: PreviewImageFactory.bundledData(named: "model-result.jpg"),
            garmentSnapshot: "Top: \(top.name) • Bottom: \(bottom.name)",
            completedAt: .now,
            look: look
        )
        look.variants.append(variant)
        context.insert(look)
        context.insert(variant)
    }

    private func seedReferenceIfNeeded(context: ModelContext) throws {
        var descriptor = FetchDescriptor<ReferencePhoto>()
        descriptor.fetchLimit = 1
        guard try context.fetch(descriptor).isEmpty else { return }
        context.insert(ReferencePhoto(
            name: String(localized: "Editorial sample"),
            imageData: PreviewImageFactory.bundledData(named: "model-create.jpg") ?? PreviewImageFactory.referencePoster(),
            isDefault: true
        ))
    }
}

private struct PreviewGarmentSeed {
    let name: String
    let category: GarmentCategory
    let hex: String
    let symbol: String
    let assetName: String?

    init(_ name: String, _ category: GarmentCategory, _ hex: String, _ symbol: String, _ assetName: String?) {
        self.name = name
        self.category = category
        self.hex = hex
        self.symbol = symbol
        self.assetName = assetName
    }
}
