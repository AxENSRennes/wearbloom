import Foundation
import OpenAPIRuntime
import WearBloomContract

actor WearBloomAPI {
    static let shared = WearBloomAPI()

    private let session: URLSession
    private let baseURL: URL?
    private let credentials: APISessionCredentialStore
    private let integrityProvider: AppAttestCoordinator?
    private var sessionTask: Task<Void, Error>?

    var isConfigured: Bool { baseURL != nil }

    init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 120
        configuration.httpCookieAcceptPolicy = .never
        session = URLSession(configuration: configuration)
        let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        let resolvedURL = value.flatMap { $0.isEmpty || $0.hasPrefix("REPLACE_") ? nil : URL(string: $0) }
        baseURL = resolvedURL
        let credentialStore = APISessionCredentialStore()
        credentials = credentialStore
        integrityProvider = resolvedURL.map { AppAttestCoordinator(baseURL: $0, credentials: credentialStore) }
    }
}

extension WearBloomAPI {
    func render(_ input: RemoteLookInput) async throws -> RemoteRenderResult {
        let garmentAssets = try await synchronizeGarments(input.garments)
        let referenceAsset = try await saveReference(input.reference, isDefault: true)
        try await synchronizeLook(input)
        let renderID = try await enqueueRender(input)
        let data = try await waitForRender(renderID)
        return RemoteRenderResult(
            data: data,
            renderID: renderID,
            garmentAssets: garmentAssets,
            referenceAsset: referenceAsset
        )
    }

    private func synchronizeGarments(_ garments: [RemoteGarmentInput]) async throws -> [UUID: UUID] {
        var garmentAssets: [UUID: UUID] = [:]
        for garment in garments {
            let assetID = try await resolveAsset(existing: garment.remoteAssetID, data: garment.imageData, purpose: "garment")
            garmentAssets[garment.id] = assetID
            let output = try await withClient { client in
                try await client.upsertGarment(
                    path: .init(id: garment.id.apiString),
                    body: .json(.init(name: garment.name, category: garment.category.contractValue, assetId: assetID.apiString))
                )
            }
            switch output {
            case .ok: break
            case let .notFound(response): throw apiError(try response.body.json)
            case let .unprocessableContent(response): throw apiError(try response.body.json)
            default: throw APIClientError.invalidResponse
            }
        }
        return garmentAssets
    }

    private func synchronizeLook(_ input: RemoteLookInput) async throws {
        let garments = input.garments.map {
            Operations.UpsertLook.Input.Body.JsonPayload.GarmentsPayloadPayload(
                id: $0.id.apiString,
                category: $0.category.contractValue
            )
        }
        let lookOutput = try await withClient { client in
            try await client.upsertLook(
                path: .init(id: input.id.apiString),
                body: .json(.init(name: input.name, note: "", garments: garments))
            )
        }
        switch lookOutput {
        case .ok: break
        case let .notFound(response): throw apiError(try response.body.json)
        case let .unprocessableContent(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
    }

    private func enqueueRender(_ input: RemoteLookInput) async throws -> UUID {
        let renderOutput = try await withClient { client in
            try await client.createRender(
                headers: .init(idempotencyKey: "ios-render-\(input.renderID.apiString)"),
                body: .json(.init(
                    renderId: input.renderID.apiString,
                    lookId: input.id.apiString,
                    referencePhotoId: input.reference.id.apiString
                ))
            )
        }
        let queued: Components.Schemas.RenderVariant
        switch renderOutput {
        case let .accepted(response): queued = try response.body.json
        case let .notFound(response): throw apiError(try response.body.json)
        case let .conflict(response): throw apiError(try response.body.json)
        case let .tooManyRequests(response): throw apiError(try response.body.json)
        case let .unprocessableContent(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
        guard let renderID = UUID(uuidString: queued.id) else { throw APIClientError.invalidResponse }
        return renderID
    }

    func waitForRender(_ id: UUID, attempts: Int = 80) async throws -> Data {
        for attempt in 0..<attempts {
            if attempt > 0 { try await Task.sleep(for: .seconds(1.5)) }
            switch try await renderStatus(id) {
            case .pending: continue
            case let .succeeded(data): return data
            case let .failed(code): throw APIClientError.renderFailed(code)
            }
        }
        throw APIClientError.timedOut
    }

    func renderStatus(_ id: UUID) async throws -> RemoteRenderStatus {
        let output = try await withClient { try await $0.getRender(path: .init(id: id.apiString)) }
        let status: Components.Schemas.RenderVariant
        switch output {
        case let .ok(response): status = try response.body.json
        case let .notFound(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
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
        let assetID = try await upload(data: data, purpose: "garment")
        let output = try await withClient {
            try await $0.detectGarment(body: .json(.init(assetId: assetID.apiString)))
        }
        let detection: Operations.DetectGarment.Output.Ok.Body.JsonPayload
        switch output {
        case let .ok(response): detection = try response.body.json
        case let .notFound(response): throw apiError(try response.body.json)
        case let .unprocessableContent(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
        guard let category = GarmentCategory(rawValue: detection.category.rawValue) else {
            throw APIClientError.invalidResponse
        }
        return GarmentDetection(assetID: assetID, category: category, confidence: detection.confidence)
    }

    @discardableResult
    func saveReference(_ input: RemoteReferenceInput, isDefault: Bool) async throws -> UUID {
        let assetID = try await resolveAsset(existing: input.remoteAssetID, data: input.imageData, purpose: "reference")
        let output = try await withClient { client in
            try await client.upsertReference(
                path: .init(id: input.id.apiString),
                body: .json(.init(
                    assetId: assetID.apiString,
                    isDefault: isDefault,
                    generatedFromVariantId: input.isGenerated ? input.generatedFromVariantID?.apiString : nil
                ))
            )
        }
        switch output {
        case .ok: return assetID
        case let .notFound(response): throw apiError(try response.body.json)
        case let .unprocessableContent(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
    }

    func accountStatus() async throws -> AccountStatus {
        let output = try await withClient { try await $0.getAccountStatus() }
        guard case let .ok(response) = output else { throw APIClientError.invalidResponse }
        let status = try response.body.json
        guard let appAccountToken = UUID(uuidString: status.appAccountToken) else {
            throw APIClientError.invalidResponse
        }
        return AccountStatus(
            userId: status.userId,
            appAccountToken: appAccountToken,
            isPro: status.isPro,
            allowance: status.allowance,
            paidAllowance: status.paidAllowance,
            used: status.used,
            remaining: status.remaining,
            periodKey: status.periodKey
        )
    }

    func privacyPreferences() async throws -> PrivacyPreferences {
        let output = try await withClient { try await $0.getPrivacyPreferences() }
        guard case let .ok(response) = output else { throw APIClientError.invalidResponse }
        let preference = try response.body.json
        return PrivacyPreferences(
            analyticsEnabled: preference.analyticsEnabled,
            diagnosticsEnabled: preference.diagnosticsEnabled,
            consentVersion: preference.consentVersion,
            updatedAt: preference.updatedAt
        )
    }

    @discardableResult
    func updatePrivacyPreferences(telemetryEnabled: Bool) async throws -> PrivacyPreferences {
        let output = try await withClient {
            try await $0.updatePrivacyPreferences(
                body: .json(.init(
                    analyticsEnabled: telemetryEnabled,
                    diagnosticsEnabled: telemetryEnabled
                ))
            )
        }
        guard case let .ok(response) = output else { throw APIClientError.invalidResponse }
        let preference = try response.body.json
        return PrivacyPreferences(
            analyticsEnabled: preference.analyticsEnabled,
            diagnosticsEnabled: preference.diagnosticsEnabled,
            consentVersion: preference.consentVersion,
            updatedAt: preference.updatedAt
        )
    }

    func syncAppleSubscription(signedTransactions: [String]) async throws {
        try await ensureAnonymousSession()
        let body = try JSONEncoder().encode(
            AppleSubscriptionSyncBody(signedTransactions: signedTransactions)
        )
        _ = try await request(path: "/v1/subscriptions/apple/sync", method: "POST", body: body)
    }

    func sendFeedback(renderID: UUID, looksLikeMe: Bool, helpful: Bool) async throws {
        let output = try await withClient {
            try await $0.submitRenderFeedback(
                path: .init(id: renderID.apiString),
                body: .json(.init(looksLikeMe: looksLikeMe, helpful: helpful))
            )
        }
        guard case .noContent = output else { throw APIClientError.invalidResponse }
    }

    func registerPushToken(_ token: String) async throws {
        guard isConfigured else { return }
        #if DEBUG
        let environment = Operations.RegisterPushDevice.Input.Body.JsonPayload.EnvironmentPayload.sandbox
        #else
        let environment = Operations.RegisterPushDevice.Input.Body.JsonPayload.EnvironmentPayload.production
        #endif
        let output = try await withClient {
            try await $0.registerPushDevice(body: .json(.init(token: token, environment: environment)))
        }
        guard case .noContent = output else { throw APIClientError.invalidResponse }
    }

    func deleteAccount() async throws {
        guard isConfigured else { return }
        let output = try await withClient { try await $0.deleteAccount() }
        switch output {
        case .accepted: break
        case let .conflict(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
        }
        await credentials.clear()
        await integrityProvider?.reset()
    }

    func deleteGarment(_ id: UUID) async throws {
        guard isConfigured else { return }
        guard case .noContent = try await withClient({ try await $0.deleteGarment(path: .init(id: id.apiString)) }) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteReference(_ id: UUID) async throws {
        guard isConfigured else { return }
        guard case .noContent = try await withClient({ try await $0.deleteReference(path: .init(id: id.apiString)) }) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteLook(_ id: UUID) async throws {
        guard isConfigured else { return }
        guard case .noContent = try await withClient({ try await $0.deleteLook(path: .init(id: id.apiString)) }) else {
            throw APIClientError.invalidResponse
        }
    }

    func deleteRender(_ id: UUID) async throws {
        guard isConfigured else { return }
        let output = try await withClient { try await $0.deleteRender(path: .init(id: id.apiString)) }
        switch output {
        case .noContent: return
        case let .conflict(response): throw apiError(try response.body.json)
        default: throw APIClientError.invalidResponse
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

    private func upload(data: Data, purpose: String) async throws -> UUID {
        typealias Part = Operations.UploadImage.Input.Body.MultipartFormPayload
        let multipart: MultipartBody<Part> = [
            .image(.init(payload: .init(body: HTTPBody(data)), filename: "image.jpg")),
            .purpose(.init(payload: .init(body: HTTPBody(purpose))))
        ]
        let output = try await withClient { try await $0.uploadImage(body: .multipartForm(multipart)) }
        switch output {
        case let .created(response):
            let body = try response.body.json
            guard let id = UUID(uuidString: body.id) else { throw APIClientError.invalidResponse }
            return id
        case let .unprocessableContent(response):
            throw apiError(try response.body.json)
        default:
            throw APIClientError.invalidResponse
        }
    }

    private func withClient<T>(_ operation: (Client) async throws -> T) async throws -> T {
        try await ensureAnonymousSession()
        do {
            return try await operation(try generatedClient())
        } catch {
            guard ContractTransportError.isSessionExpired(error) else { throw error }
            try await ensureAnonymousSession()
            return try await operation(try generatedClient())
        }
    }

    private func generatedClient() throws -> Client {
        guard let baseURL else { throw APIClientError.notConfigured }
        return WearBloomGeneratedContract.client(
            serverURL: baseURL,
            credentials: credentials,
            integrityProvider: integrityProvider
        )
    }

    private func ensureAnonymousSession() async throws {
        if await credentials.validCookie() != nil { return }
        if let sessionTask { return try await sessionTask.value }
        guard let baseURL else { throw APIClientError.notConfigured }
        let task = Task { [session, credentials] in
            var request = URLRequest(url: baseURL.appending(path: "/v1/auth/sign-in/anonymous"))
            request.httpMethod = "POST"
            request.httpBody = Data("{}".utf8)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let (data, response) = try await session.data(for: request)
            try Self.validate(data, response)
            guard let http = response as? HTTPURLResponse,
                  let setCookie = http.value(forHTTPHeaderField: "Set-Cookie") else {
                throw APIClientError.invalidResponse
            }
            try await credentials.update(setCookie: setCookie, url: baseURL)
            guard await credentials.validCookie() != nil else { throw APIClientError.invalidResponse }
        }
        sessionTask = task
        defer { sessionTask = nil }
        try await task.value
    }

    private func request(path: String, method: String = "GET", body: Data? = nil, retryOnExpiration: Bool = true) async throws -> Data {
        guard let baseURL else { throw APIClientError.notConfigured }
        let url: URL
        if path.hasPrefix("http") {
            guard let absoluteURL = URL(string: path) else { throw APIClientError.invalidResponse }
            url = absoluteURL
        } else {
            url = baseURL.appending(path: path)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let cookie = await credentials.validCookie() { request.setValue(cookie, forHTTPHeaderField: "Cookie") }
        let (data, response) = try await session.data(for: request)
        if let http = response as? HTTPURLResponse,
           let setCookie = http.value(forHTTPHeaderField: "Set-Cookie") {
            try await credentials.update(setCookie: setCookie, url: baseURL)
        }
        if let http = response as? HTTPURLResponse, http.statusCode == 401, retryOnExpiration {
            await credentials.clear()
            try await ensureAnonymousSession()
            return try await self.request(path: path, method: method, body: body, retryOnExpiration: false)
        }
        try Self.validate(data, response)
        return data
    }

    private static func validate(_ data: Data, _ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw APIClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            if let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                throw APIClientError.server(code: envelope.error.code, message: envelope.error.message)
            }
            throw APIClientError.invalidResponse
        }
    }
}

private extension UUID {
    var apiString: String { uuidString.lowercased() }
}

private extension GarmentCategory {
    var contractValue: Components.Schemas.GarmentCategory {
        switch self {
        case .top: .top
        case .bottom: .bottom
        case .dress: .dress
        case .outerwear: .outerwear
        }
    }
}

private func apiError(_ envelope: Components.Schemas._Error) -> APIClientError {
    .server(code: envelope.error.code, message: envelope.error.message)
}
