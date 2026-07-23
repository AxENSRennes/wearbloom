import Foundation

struct RemoteGarmentInput: Sendable {
    let id: UUID
    let name: String
    let category: GarmentCategory
    let imageData: Data
    let remoteAssetID: UUID?
}

struct RemoteReferenceInput: Sendable {
    let id: UUID
    let imageData: Data
    let remoteAssetID: UUID?
    let isGenerated: Bool
    let generatedFromVariantID: UUID?
}

struct RemoteLookInput: Sendable {
    let id: UUID
    let renderID: UUID
    let name: String
    let garments: [RemoteGarmentInput]
    let reference: RemoteReferenceInput
}

struct RemoteRenderResult: Sendable {
    let data: Data
    let renderID: UUID
    let garmentAssets: [UUID: UUID]
    let referenceAsset: UUID
}

enum RemoteRenderStatus: Sendable {
    case pending
    case succeeded(Data)
    case failed(String)
}

struct GarmentDetection: Sendable {
    let assetID: UUID
    let category: GarmentCategory
    let confidence: Double
}

struct AccountStatus: Sendable {
    let userId: String
    let isPro: Bool
    let allowance: Int
    let paidAllowance: Int
    let used: Int
    let remaining: Int
    let periodKey: String
}

enum APIClientError: LocalizedError {
    case notConfigured
    case invalidResponse
    case server(code: String, message: String)
    case renderFailed(String)
    case timedOut

    var errorDescription: String? {
        switch self {
        case .notConfigured: String(localized: "The generation service is not configured.")
        case .invalidResponse: String(localized: "The generation service returned an invalid response.")
        case let .server(code, _): Self.serverMessage(for: code)
        case .renderFailed: String(localized: "The render failed. No generation was used.")
        case .timedOut: String(localized: "The render is still working. Check Looks again shortly.")
        }
    }

    private static func serverMessage(for code: String) -> String {
        switch code {
        case "QUOTA_EXHAUSTED": String(localized: "You have used this period’s previews.")
        case "LOOK_INCOMPLETE": String(localized: "Choose a dress or both a top and bottom first.")
        case "UPLOAD_TOO_LARGE": String(localized: "That image is too large. Choose a smaller photo.")
        case "UPLOAD_INVALID_IMAGE", "UPLOAD_UNSUPPORTED_TYPE": String(localized: "Choose a valid JPEG, PNG, or HEIC image.")
        case "UPLOAD_COUNT_EXCEEDED": String(localized: "Delete an older image before uploading another.")
        case "APP_ATTEST_REQUIRED", "APP_ATTEST_INVALID": String(localized: "WearBloom could not verify this app installation. Please try again.")
        case "AUTH_REQUIRED": String(localized: "Your session expired. Please try again.")
        default: String(localized: "Something went wrong. Please try again.")
        }
    }
}

struct AppleSignInBody: Encodable {
    let identityToken: String
    let authorizationCode: String
    let nonce: String
}

struct ErrorEnvelope: Decodable {
    struct Details: Decodable { let code: String; let message: String }
    let error: Details
}
