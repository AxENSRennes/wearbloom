import Foundation

/// Application-facing boundary for remote library operations.
///
/// Views depend on this coordinator instead of knowing which transport or
/// generated API client implements an operation.
actor RemoteLibraryCoordinator {
    static let shared = RemoteLibraryCoordinator()

    var isConfigured: Bool {
        get async { await WearBloomAPI.shared.isConfigured }
    }

    func detectGarment(data: Data) async throws -> GarmentDetection {
        try await WearBloomAPI.shared.detectGarment(data: data)
    }

    func saveReference(_ input: RemoteReferenceInput, isDefault: Bool) async throws -> UUID {
        try await WearBloomAPI.shared.saveReference(input, isDefault: isDefault)
    }

    func deleteGarment(_ id: UUID) async throws {
        try await WearBloomAPI.shared.deleteGarment(id)
    }

    func deleteReference(_ id: UUID) async throws {
        try await WearBloomAPI.shared.deleteReference(id)
    }

    func deleteLook(_ id: UUID) async throws {
        try await WearBloomAPI.shared.deleteLook(id)
    }

    func deleteRender(_ id: UUID?) async throws {
        guard let id else { return }
        try await WearBloomAPI.shared.deleteRender(id)
    }

    func sendFeedback(renderID: UUID, looksLikeMe: Bool, helpful: Bool) async throws {
        try await WearBloomAPI.shared.sendFeedback(
            renderID: renderID,
            looksLikeMe: looksLikeMe,
            helpful: helpful
        )
    }

    func linkAppleAccount(
        identityToken: String,
        authorizationCode: String,
        nonce: String
    ) async throws -> AccountStatus {
        try await WearBloomAPI.shared.signInWithApple(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            nonce: nonce
        )
        return try await WearBloomAPI.shared.accountStatus()
    }

    func deleteAccount() async throws {
        try await WearBloomAPI.shared.deleteAccount()
    }

    func registerPushToken(_ token: String) async {
        do {
            try await WearBloomAPI.shared.registerPushToken(token)
        } catch {
            Telemetry.error(error, context: ["operation": "push_token_registration"])
        }
    }
}
