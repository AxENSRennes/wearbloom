import CryptoKit
import DeviceCheck
import Foundation
import Security

enum AppAttestClientError: LocalizedError {
    case enrollmentFailed
    case invalidServerResponse

    var errorDescription: String? {
        switch self {
        case .enrollmentFailed: "WearBloom could not verify this app installation. Please try again."
        case .invalidServerResponse: "The integrity service returned an invalid response."
        }
    }
}

actor AppAttestCoordinator {
    static let shared = AppAttestCoordinator()
    private let service = DCAppAttestService.shared
    private let session = URLSession(configuration: .ephemeral)

    func headers(
        baseURL: URL,
        cookie: String?,
        method: String,
        path: String,
        body: Data
    ) async throws -> [String: String] {
        guard service.isSupported else {
            // Apple does not support App Attest in Simulator. Production requires a real assertion.
            return ["X-App-Attest-Unsupported": "true"]
        }

        let keyID = try await enrolledKey(baseURL: baseURL, cookie: cookie)
        let challenge = try await challenge(baseURL: baseURL, cookie: cookie)
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
        AppAttestKeychain.delete()
    }

    private func enrolledKey(baseURL: URL, cookie: String?) async throws -> String {
        if let existing = AppAttestKeychain.load() { return existing }
        let challenge = try await challenge(baseURL: baseURL, cookie: cookie)
        let keyID = try await service.generateKey()
        let clientDataHash = Data(SHA256.hash(data: Data(challenge.utf8)))
        let attestation = try await service.attestKey(keyID, clientDataHash: clientDataHash)
        let payload = try JSONEncoder().encode(EnrollmentBody(
            challenge: challenge,
            keyId: keyID,
            attestation: attestation.base64EncodedString()
        ))
        var request = URLRequest(url: baseURL.appending(path: "/v1/attest/verify"))
        request.httpMethod = "POST"
        request.httpBody = payload
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let cookie { request.setValue(cookie, forHTTPHeaderField: "Cookie") }
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 204 else {
            throw AppAttestClientError.enrollmentFailed
        }
        AppAttestKeychain.save(keyID)
        return keyID
    }

    private func challenge(baseURL: URL, cookie: String?) async throws -> String {
        var request = URLRequest(url: baseURL.appending(path: "/v1/attest/challenge"))
        if let cookie { request.setValue(cookie, forHTTPHeaderField: "Cookie") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode),
              let challenge = try? JSONDecoder().decode(ChallengeBody.self, from: data).challenge else {
            throw AppAttestClientError.invalidServerResponse
        }
        return challenge
    }
}

private struct ChallengeBody: Decodable { let challenge: String }
private struct EnrollmentBody: Encodable { let challenge: String; let keyId: String; let attestation: String }

private enum AppAttestKeychain {
    private static let service = "app.wearbloom.app-attest"
    private static let account = "key-id"

    static func save(_ value: String) {
        delete()
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(value.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    private static var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
}
