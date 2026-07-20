import Foundation
import Security

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
}

struct RemoteLookInput: Sendable {
    let id: UUID
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

struct GarmentDetection: Sendable {
    let assetID: UUID
    let category: GarmentCategory
    let confidence: Double
}

struct AccountStatus: Decodable, Sendable {
    let userId: String
    let isPro: Bool
    let allowance: Int
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
        case .notConfigured: "The generation service is not configured."
        case .invalidResponse: "The generation service returned an invalid response."
        case let .server(_, message): message
        case let .renderFailed(code): "The render failed (\(code)). No generation was used."
        case .timedOut: "The render is still working. Check Looks again shortly."
        }
    }
}

actor WearBloomAPI {
    static let shared = WearBloomAPI()

    private let session: URLSession
    private let baseURL: URL?
    private var sessionCookie: String?

    var isConfigured: Bool { baseURL != nil }

    init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 120
        configuration.httpCookieAcceptPolicy = .always
        session = URLSession(configuration: configuration)
        let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        baseURL = value.flatMap { $0.isEmpty || $0.hasPrefix("REPLACE_") ? nil : URL(string: $0) }
        sessionCookie = KeychainCredential.load()
    }

    func render(_ input: RemoteLookInput) async throws -> RemoteRenderResult {
        try await ensureAnonymousSession()
        var garmentAssets: [UUID: UUID] = [:]
        for garment in input.garments {
            let assetID = try await resolveAsset(existing: garment.remoteAssetID, data: garment.imageData, purpose: "garment")
            garmentAssets[garment.id] = assetID
            let body = try JSONEncoder().encode(SaveGarmentBody(name: garment.name, category: garment.category.rawValue, assetId: assetID))
            _ = try await request(path: "/v1/garments/\(garment.id.uuidString.lowercased())", method: "PUT", body: body)
        }
        let referenceAsset = try await resolveAsset(existing: input.reference.remoteAssetID, data: input.reference.imageData, purpose: "reference")
        let referenceBody = try JSONEncoder().encode(SaveReferenceBody(assetId: referenceAsset, isDefault: true))
        _ = try await request(path: "/v1/references/\(input.reference.id.uuidString.lowercased())", method: "PUT", body: referenceBody)

        let lookBody = try JSONEncoder().encode(SaveLookBody(
            name: input.name,
            note: "",
            garments: input.garments.map { LookGarmentBody(id: $0.id, category: $0.category.rawValue) }
        ))
        _ = try await request(path: "/v1/looks/\(input.id.uuidString.lowercased())", method: "PUT", body: lookBody)
        let renderBody = try JSONEncoder().encode(CreateRenderBody(lookId: input.id, referencePhotoId: input.reference.id))
        let queuedData = try await request(
            path: "/v1/renders",
            method: "POST",
            body: renderBody,
            headers: ["Idempotency-Key": "ios-\(UUID().uuidString.lowercased())"],
            protectsIntegrity: true
        )
        let queued = try JSONDecoder().decode(RenderResponse.self, from: queuedData)

        for _ in 0..<80 {
            try await Task.sleep(for: .seconds(1.5))
            let statusData = try await request(path: "/v1/renders/\(queued.id.uuidString.lowercased())")
            let status = try JSONDecoder().decode(RenderResponse.self, from: statusData)
            switch status.status {
            case "succeeded":
                guard let resultURL = status.resultURL else { throw APIClientError.invalidResponse }
                let data = try await request(path: resultURL)
                return RemoteRenderResult(data: data, renderID: status.id, garmentAssets: garmentAssets, referenceAsset: referenceAsset)
            case "failed", "cancelled":
                throw APIClientError.renderFailed(status.errorCode ?? "RENDER_FAILED")
            default:
                continue
            }
        }
        throw APIClientError.timedOut
    }

    func detectGarment(data: Data) async throws -> GarmentDetection {
        try await ensureAnonymousSession()
        let assetID = try await upload(data: data, purpose: "garment")
        let body = try JSONEncoder().encode(DetectGarmentBody(assetId: assetID))
        let response = try await request(path: "/v1/garments/detect", method: "POST", body: body)
        let detection = try JSONDecoder().decode(DetectionResponse.self, from: response)
        guard let category = GarmentCategory(rawValue: detection.category) else {
            throw APIClientError.invalidResponse
        }
        return GarmentDetection(assetID: assetID, category: category, confidence: detection.confidence)
    }

    func accountStatus() async throws -> AccountStatus {
        try await ensureAnonymousSession()
        let data = try await request(path: "/v1/account/status")
        return try JSONDecoder().decode(AccountStatus.self, from: data)
    }

    func sendFeedback(renderID: UUID, looksLikeMe: Bool, helpful: Bool) async throws {
        let body = try JSONEncoder().encode(FeedbackBody(looksLikeMe: looksLikeMe, helpful: helpful))
        _ = try await request(path: "/v1/renders/\(renderID.uuidString.lowercased())/feedback", method: "POST", body: body)
    }

    func deleteAccount() async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        _ = try await request(path: "/v1/account", method: "DELETE")
        sessionCookie = nil
        KeychainCredential.delete()
    }

    func deleteGarment(_ id: UUID) async throws {
        try await deleteResource(path: "/v1/garments/\(id.uuidString.lowercased())")
    }

    func deleteReference(_ id: UUID) async throws {
        try await deleteResource(path: "/v1/references/\(id.uuidString.lowercased())")
    }

    func deleteLook(_ id: UUID) async throws {
        try await deleteResource(path: "/v1/looks/\(id.uuidString.lowercased())")
    }

    func signInWithApple(identityToken: String, authorizationCode: String, nonce: String) async throws {
        try await ensureAnonymousSession()
        let body = try JSONEncoder().encode(AppleSignInBody(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            nonce: nonce
        ))
        _ = try await request(path: "/v1/auth/sign-in/apple-native", method: "POST", body: body)
    }

    private func resolveAsset(existing: UUID?, data: Data, purpose: String) async throws -> UUID {
        if let existing { return existing }
        return try await upload(data: data, purpose: purpose)
    }

    private func deleteResource(path: String) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        _ = try await request(path: path, method: "DELETE")
    }

    private func upload(data: Data, purpose: String) async throws -> UUID {
        guard let baseURL else { throw APIClientError.notConfigured }
        let boundary = "WearBloom-\(UUID().uuidString)"
        var body = Data()
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"purpose\"\r\n\r\n\(purpose)\r\n".utf8))
        body.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"image\"; filename=\"image.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n--\(boundary)--\r\n".utf8))
        var request = URLRequest(url: baseURL.appending(path: "/v1/uploads"))
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        applyCredential(to: &request)
        for (name, value) in try await AppAttestCoordinator.shared.headers(
            baseURL: baseURL,
            cookie: sessionCookie,
            method: "POST",
            path: "/v1/uploads",
            body: body
        ) {
            request.setValue(value, forHTTPHeaderField: name)
        }
        let (responseData, response) = try await session.data(for: request)
        try validate(responseData, response)
        return try JSONDecoder().decode(UploadResponse.self, from: responseData).id
    }

    private func ensureAnonymousSession() async throws {
        if sessionCookie != nil { return }
        guard let baseURL else { throw APIClientError.notConfigured }
        var request = URLRequest(url: baseURL.appending(path: "/v1/auth/sign-in/anonymous"))
        request.httpMethod = "POST"
        request.httpBody = Data("{}".utf8)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        try validate(data, response)
        captureCredential(from: response)
        guard let http = response as? HTTPURLResponse,
              let setCookie = http.value(forHTTPHeaderField: "Set-Cookie"),
              let pair = setCookie.split(separator: ";", maxSplits: 1).first else {
            throw APIClientError.invalidResponse
        }
        sessionCookie = String(pair)
        KeychainCredential.save(String(pair))
    }

    private func request(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        headers: [String: String] = [:],
        protectsIntegrity: Bool = false
    ) async throws -> Data {
        guard let baseURL else { throw APIClientError.notConfigured }
        let url = path.hasPrefix("http") ? URL(string: path)! : baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        applyCredential(to: &request)
        if protectsIntegrity {
            for (name, value) in try await AppAttestCoordinator.shared.headers(
                baseURL: baseURL,
                cookie: sessionCookie,
                method: method,
                path: path,
                body: body ?? Data()
            ) {
                request.setValue(value, forHTTPHeaderField: name)
            }
        }
        let (data, response) = try await session.data(for: request)
        try validate(data, response)
        captureCredential(from: response)
        return data
    }

    private func applyCredential(to request: inout URLRequest) {
        if let sessionCookie { request.setValue(sessionCookie, forHTTPHeaderField: "Cookie") }
    }

    private func captureCredential(from response: URLResponse) {
        guard let http = response as? HTTPURLResponse,
              let setCookie = http.value(forHTTPHeaderField: "Set-Cookie"),
              let pair = setCookie.split(separator: ";", maxSplits: 1).first else { return }
        sessionCookie = String(pair)
        KeychainCredential.save(String(pair))
    }

    private func validate(_ data: Data, _ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            if let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                throw APIClientError.server(code: envelope.error.code, message: envelope.error.message)
            }
            throw APIClientError.invalidResponse
        }
    }
}

private enum KeychainCredential {
    static let service = "app.wearbloom.api-session"
    static let account = "better-auth-cookie"

    static func save(_ value: String) {
        let data = Data(value.utf8)
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load() -> String? {
        var attributes = query
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(attributes as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete() {
        SecItemDelete(query as CFDictionary)
    }

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
}

private struct UploadResponse: Decodable { let id: UUID }
private struct SaveGarmentBody: Encodable { let name: String; let category: String; let assetId: UUID }
private struct SaveReferenceBody: Encodable { let assetId: UUID; let isDefault: Bool }
private struct LookGarmentBody: Encodable { let id: UUID; let category: String }
private struct SaveLookBody: Encodable { let name: String; let note: String; let garments: [LookGarmentBody] }
private struct CreateRenderBody: Encodable { let lookId: UUID; let referencePhotoId: UUID }
private struct DetectGarmentBody: Encodable { let assetId: UUID }
private struct DetectionResponse: Decodable { let category: String; let confidence: Double }
private struct FeedbackBody: Encodable { let looksLikeMe: Bool; let helpful: Bool }
private struct AppleSignInBody: Encodable {
    let identityToken: String
    let authorizationCode: String
    let nonce: String
}
private struct RenderResponse: Decodable {
    let id: UUID
    let status: String
    let resultURL: String?
    let errorCode: String?
}
private struct ErrorEnvelope: Decodable {
    struct Details: Decodable { let code: String; let message: String }
    let error: Details
}
