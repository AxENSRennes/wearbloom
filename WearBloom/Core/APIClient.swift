import Foundation
import Security
import WearBloomContract

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

struct AccountStatus: Decodable, Sendable {
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
        let referenceAsset = try await saveReference(input.reference, isDefault: true)

        let lookBody = try JSONEncoder().encode(SaveLookBody(
            name: input.name,
            note: "",
            garments: input.garments.map { LookGarmentBody(id: $0.id, category: $0.category.rawValue) }
        ))
        _ = try await request(path: "/v1/looks/\(input.id.uuidString.lowercased())", method: "PUT", body: lookBody)
        let renderBody = try JSONEncoder().encode(CreateRenderBody(
            renderId: input.renderID,
            lookId: input.id,
            referencePhotoId: input.reference.id
        ))
        let queuedData = try await request(
            path: "/v1/renders",
            method: "POST",
            body: renderBody,
            headers: ["Idempotency-Key": "ios-render-\(input.renderID.uuidString.lowercased())"],
            protectsIntegrity: true
        )
        let queued = try JSONDecoder().decode(RenderResponse.self, from: queuedData)

        let data = try await waitForRender(queued.id)
        return RemoteRenderResult(data: data, renderID: queued.id, garmentAssets: garmentAssets, referenceAsset: referenceAsset)
    }

    func waitForRender(_ id: UUID, attempts: Int = 80) async throws -> Data {
        for attempt in 0..<attempts {
            if attempt > 0 { try await Task.sleep(for: .seconds(1.5)) }
            switch try await renderStatus(id) {
            case .pending:
                continue
            case let .succeeded(data):
                return data
            case let .failed(code):
                throw APIClientError.renderFailed(code)
            }
        }
        throw APIClientError.timedOut
    }

    func renderStatus(_ id: UUID) async throws -> RemoteRenderStatus {
        try await ensureAnonymousSession()
        guard let baseURL else { throw APIClientError.notConfigured }
        let client = WearBloomGeneratedContract.client(serverURL: baseURL, cookie: sessionCookie)
        let output = try await client.getRender(path: .init(id: id.uuidString.lowercased()))
        guard case let .ok(response) = output else { throw APIClientError.invalidResponse }
        let status = try response.body.json
        switch status.status {
        case .succeeded:
            guard let resultURL = status.resultURL else { throw APIClientError.invalidResponse }
            return .succeeded(try await request(path: resultURL))
        case .failed, .cancelled:
            return .failed(status.errorCode ?? "RENDER_FAILED")
        default:
            return .pending
        }
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

    @discardableResult
    func saveReference(_ input: RemoteReferenceInput, isDefault: Bool) async throws -> UUID {
        try await ensureAnonymousSession()
        let assetID = try await resolveAsset(existing: input.remoteAssetID, data: input.imageData, purpose: "reference")
        let body = try JSONEncoder().encode(SaveReferenceBody(
            assetId: assetID,
            isDefault: isDefault,
            generatedFromVariantId: input.isGenerated ? input.generatedFromVariantID : nil
        ))
        _ = try await request(
            path: "/v1/references/\(input.id.uuidString.lowercased())",
            method: "PUT",
            body: body
        )
        return assetID
    }

    func accountStatus() async throws -> AccountStatus {
        try await ensureAnonymousSession()
        guard let baseURL else { throw APIClientError.notConfigured }
        let client = WearBloomGeneratedContract.client(serverURL: baseURL, cookie: sessionCookie)
        let output = try await client.getAccountStatus()
        guard case let .ok(response) = output else { throw APIClientError.invalidResponse }
        let status = try response.body.json
        return AccountStatus(
            userId: status.userId,
            isPro: status.isPro,
            allowance: status.allowance,
            paidAllowance: status.paidAllowance,
            used: status.used,
            remaining: status.remaining,
            periodKey: status.periodKey
        )
    }

    func sendFeedback(renderID: UUID, looksLikeMe: Bool, helpful: Bool) async throws {
        try await ensureAnonymousSession()
        let client = try generatedClient()
        let output = try await client.submitRenderFeedback(
            path: .init(id: renderID.uuidString.lowercased()),
            body: .json(.init(looksLikeMe: looksLikeMe, helpful: helpful))
        )
        guard case .noContent = output else { throw APIClientError.invalidResponse }
    }

    func registerPushToken(_ token: String) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let client = try generatedClient()
        let contractEnvironment: Operations.RegisterPushDevice.Input.Body.JsonPayload.EnvironmentPayload = environment == "sandbox"
            ? .sandbox
            : .production
        let output = try await client.registerPushDevice(
            body: .json(.init(token: token, environment: contractEnvironment))
        )
        guard case .noContent = output else { throw APIClientError.invalidResponse }
    }

    func deleteAccount() async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        let output = try await generatedClient().deleteAccount()
        switch output {
        case .accepted:
            break
        case let .conflict(response):
            let envelope = try response.body.json
            throw APIClientError.server(code: envelope.error.code, message: envelope.error.message)
        default:
            throw APIClientError.invalidResponse
        }
        sessionCookie = nil
        KeychainCredential.delete()
    }

    func deleteGarment(_ id: UUID) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        guard case .noContent = try await generatedClient().deleteGarment(path: .init(id: id.uuidString.lowercased())) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteReference(_ id: UUID) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        guard case .noContent = try await generatedClient().deleteReference(path: .init(id: id.uuidString.lowercased())) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteLook(_ id: UUID) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        guard case .noContent = try await generatedClient().deleteLook(path: .init(id: id.uuidString.lowercased())) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteRender(_ id: UUID) async throws {
        guard isConfigured else { return }
        try await ensureAnonymousSession()
        let output = try await generatedClient().deleteRender(path: .init(id: id.uuidString.lowercased()))
        switch output {
        case .noContent:
            return
        case let .conflict(response):
            let envelope = try response.body.json
            throw APIClientError.server(code: envelope.error.code, message: envelope.error.message)
        default:
            throw APIClientError.invalidResponse
        }
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

    private func generatedClient() throws -> Client {
        guard let baseURL else { throw APIClientError.notConfigured }
        return WearBloomGeneratedContract.client(serverURL: baseURL, cookie: sessionCookie)
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
private struct SaveReferenceBody: Encodable {
    let assetId: UUID
    let isDefault: Bool
    let generatedFromVariantId: UUID?
}
private struct LookGarmentBody: Encodable { let id: UUID; let category: String }
private struct SaveLookBody: Encodable { let name: String; let note: String; let garments: [LookGarmentBody] }
private struct CreateRenderBody: Encodable { let renderId: UUID; let lookId: UUID; let referencePhotoId: UUID }
private struct DetectGarmentBody: Encodable { let assetId: UUID }
private struct DetectionResponse: Decodable { let category: String; let confidence: Double }
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
