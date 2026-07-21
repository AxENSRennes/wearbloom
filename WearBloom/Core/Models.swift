import Foundation
import SwiftData

enum GarmentCategory: String, Codable, CaseIterable, Identifiable {
    case top
    case bottom
    case dress
    case outerwear

    var id: String { rawValue }

    var title: String {
        switch self {
        case .top: String(localized: "Top")
        case .bottom: String(localized: "Bottom")
        case .dress: String(localized: "Dress")
        case .outerwear: String(localized: "Outerwear")
        }
    }

    var prompt: String {
        switch self {
        case .top: String(localized: "Add a top")
        case .bottom: String(localized: "Add a bottom")
        case .dress: String(localized: "Or choose a dress")
        case .outerwear: String(localized: "Add a layer")
        }
    }

    var symbol: String {
        switch self {
        case .top: "tshirt"
        case .bottom: "figure.stand.dress.line.vertical.figure"
        case .dress: "figure.dress.line.vertical.figure"
        case .outerwear: "jacket"
        }
    }
}

enum RenderState: String, Codable {
    case queued
    case rendering
    case ready
    case failed
}

@Model
final class Garment {
    @Attribute(.unique) var id: UUID
    var name: String
    var categoryRawValue: String
    var imageData: Data?
    var originalImageData: Data?
    var remoteAssetID: UUID?
    var colorHex: String
    var isFavorite: Bool
    var createdAt: Date
    var isArchived: Bool = false
    var wearCount: Int = 0
    var lastWornAt: Date?
    var careNote: String = ""

    var category: GarmentCategory {
        get { GarmentCategory(rawValue: categoryRawValue) ?? .top }
        set { categoryRawValue = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        name: String,
        category: GarmentCategory,
        imageData: Data? = nil,
        originalImageData: Data? = nil,
        remoteAssetID: UUID? = nil,
        colorHex: String = "#5B3DF5",
        isFavorite: Bool = false,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        categoryRawValue = category.rawValue
        self.imageData = imageData
        self.originalImageData = originalImageData ?? imageData
        self.remoteAssetID = remoteAssetID
        self.colorHex = colorHex
        self.isFavorite = isFavorite
        self.createdAt = createdAt
    }
}

@Model
final class ReferencePhoto {
    @Attribute(.unique) var id: UUID
    var name: String
    var imageData: Data?
    var remoteAssetID: UUID?
    var isDefault: Bool
    var isGeneratedReference: Bool
    var createdAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        imageData: Data?,
        remoteAssetID: UUID? = nil,
        isDefault: Bool = false,
        isGeneratedReference: Bool = false,
        createdAt: Date = .now
    ) {
        self.id = id
        self.name = name
        self.imageData = imageData
        self.remoteAssetID = remoteAssetID
        self.isDefault = isDefault
        self.isGeneratedReference = isGeneratedReference
        self.createdAt = createdAt
    }
}

@Model
final class Look {
    @Attribute(.unique) var id: UUID
    var name: String
    var note: String
    var createdAt: Date
    var updatedAt: Date
    var isFavorite: Bool
    var wearCount: Int = 0
    var lastWornAt: Date?
    var plannedDate: Date?
    var collectionName: String = "Everyday"
    var sourceRawValue: String = "manual"
    @Relationship(deleteRule: .nullify) var garments: [Garment]
    @Relationship(deleteRule: .cascade, inverse: \RenderVariant.look) var variants: [RenderVariant]

    init(
        id: UUID = UUID(),
        name: String,
        note: String = "",
        createdAt: Date = .now,
        updatedAt: Date = .now,
        isFavorite: Bool = false,
        garments: [Garment] = [],
        variants: [RenderVariant] = []
    ) {
        self.id = id
        self.name = name
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isFavorite = isFavorite
        self.garments = garments
        self.variants = variants
    }
}

@Model
final class WearEvent {
    @Attribute(.unique) var id: UUID
    var date: Date
    var note: String
    var isPlanned: Bool
    var createdAt: Date
    @Relationship(deleteRule: .nullify) var look: Look?
    @Relationship(deleteRule: .nullify) var garments: [Garment]

    init(
        id: UUID = UUID(),
        date: Date = .now,
        note: String = "",
        isPlanned: Bool = false,
        createdAt: Date = .now,
        look: Look? = nil,
        garments: [Garment] = []
    ) {
        self.id = id
        self.date = date
        self.note = note
        self.isPlanned = isPlanned
        self.createdAt = createdAt
        self.look = look
        self.garments = garments
    }
}

@Model
final class RenderVariant {
    @Attribute(.unique) var id: UUID
    var sequence: Int
    var stateRawValue: String
    var resultData: Data?
    var referenceSnapshotData: Data?
    var garmentSnapshot: String
    var createdAt: Date
    var completedAt: Date?
    var feedbackLooksLikeMe: Bool?
    var feedbackHelpful: Bool?
    var isPreviewSimulation: Bool
    var remoteRenderID: UUID?
    var look: Look?

    var state: RenderState {
        get { RenderState(rawValue: stateRawValue) ?? .failed }
        set { stateRawValue = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        sequence: Int,
        state: RenderState = .queued,
        resultData: Data? = nil,
        referenceSnapshotData: Data? = nil,
        garmentSnapshot: String,
        createdAt: Date = .now,
        completedAt: Date? = nil,
        isPreviewSimulation: Bool = true,
        remoteRenderID: UUID? = nil,
        look: Look? = nil
    ) {
        self.id = id
        self.sequence = sequence
        stateRawValue = state.rawValue
        self.resultData = resultData
        self.referenceSnapshotData = referenceSnapshotData
        self.garmentSnapshot = garmentSnapshot
        self.createdAt = createdAt
        self.completedAt = completedAt
        self.isPreviewSimulation = isPreviewSimulation
        self.remoteRenderID = remoteRenderID
        self.look = look
    }
}
