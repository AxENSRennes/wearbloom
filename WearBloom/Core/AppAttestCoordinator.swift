import CryptoKit
import DeviceCheck
import Foundation
import WearBloomContract

enum AppAttestClientError: LocalizedError {
    case enrollmentFailed
    case invalidServerResponse

    var errorDescription: String? {
        switch self {
        case .enrollmentFailed: String(localized: "WearBloom could not verify this app installation. Please try again.")
        case .invalidServerResponse: String(localized: "The integrity service returned an invalid response.")
        }
    }
}

actor AppAttestCoordinator: RequestIntegrityProvider {
    private static let keychainService = "app.wearbloom.app-attest"
    private static let keychainAccount = "key-id"

    private let service = DCAppAttestService.shared
    private let baseURL: URL
    private let credentials: APISessionCredentialStore

    init(baseURL: URL, credentials: APISessionCredentialStore) {
        self.baseURL = baseURL
        self.credentials = credentials
    }

    func headers(method: String, path: String, body: Data) async throws -> [String: String] {
        guard service.isSupported else {
            // Apple does not support App Attest in Simulator. Production requires a real assertion.
            return ["X-App-Attest-Unsupported": "true"]
        }

        let keyID = try await enrolledKey()
        let challenge = try await challenge()
        let bodyDigest = Data(SHA256.hash(data: body)).base64EncodedString()
        let canonical = "\(challenge)\n\(method.uppercased())\n\(path)\n\(bodyDigest)"
        let clientDataHash = Data(SHA256.hash(data: Data(canonical.utf8)))
        let assertion = try await service.generateAssertion(keyID, clientDataHash: clientDataHash)
        return [
            "X-App-Attest-Challenge": challenge,
            "X-App-Attest-Key-ID": keyID,
            "X-App-Attest-Assertion": assertion.base64EncodedString()
        ]
    }

    func reset() {
        SecureValueStore.delete(service: Self.keychainService, account: Self.keychainAccount)
    }

    private func enrolledKey() async throws -> String {
        if let data = SecureValueStore.load(service: Self.keychainService, account: Self.keychainAccount),
           let existing = String(data: data, encoding: .utf8) {
            return existing
        }
        let challenge = try await challenge()
        let keyID = try await service.generateKey()
        let clientDataHash = Data(SHA256.hash(data: Data(challenge.utf8)))
        let attestation = try await service.attestKey(keyID, clientDataHash: clientDataHash)
        let output = try await client().verifyAppAttest(
            body: .json(.init(
                challenge: challenge,
                keyId: keyID,
                attestation: attestation.base64EncodedString()
            ))
        )
        guard case .noContent = output else { throw AppAttestClientError.enrollmentFailed }
        try SecureValueStore.save(Data(keyID.utf8), service: Self.keychainService, account: Self.keychainAccount)
        return keyID
    }

    private func challenge() async throws -> String {
        let output = try await client().getAttestChallenge()
        guard case let .ok(response) = output else { throw AppAttestClientError.invalidServerResponse }
        return try response.body.json.challenge
    }

    private func client() -> Client {
        WearBloomGeneratedContract.client(serverURL: baseURL, credentials: credentials)
    }
}
