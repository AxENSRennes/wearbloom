import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession
import Security

public protocol RequestIntegrityProvider: Sendable {
    func headers(method: String, path: String, body: Data) async throws -> [String: String]
}

public enum ContractTransportError: Error, Equatable {
    case sessionExpired
    case bodyTooLarge

    public static func isSessionExpired(_ error: any Error) -> Bool {
        if let transportError = error as? ContractTransportError, transportError == .sessionExpired { return true }
        if let clientError = error as? ClientError { return isSessionExpired(clientError.underlyingError) }
        return false
    }
}

public enum SecureValueStore {
    public static func save(_ data: Data, service: String, account: String) throws {
        let query = baseQuery(service: service, account: account)
        let status = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }

        var attributes = query
        attributes.merge([
            kSecClass as String: kSecClassGenericPassword,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]) { _, new in new }
        let addStatus = SecItemAdd(attributes as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus))
        }
    }

    public static func load(service: String, account: String) -> Data? {
        var query = baseQuery(service: service, account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    public static func delete(service: String, account: String) {
        SecItemDelete(baseQuery(service: service, account: account) as CFDictionary)
    }

    private static func baseQuery(service: String, account: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }
}

public actor APISessionCredentialStore {
    private struct StoredCredential: Codable {
        let cookie: String
        let expiresAt: Date?
    }

    private let service: String
    private let account: String
    private var credential: StoredCredential?

    public init(service: String = "app.wearbloom.api-session", account: String = "better-auth-cookie") {
        self.service = service
        self.account = account
        if let data = SecureValueStore.load(service: service, account: account) {
            credential = try? JSONDecoder().decode(StoredCredential.self, from: data)
            if credential == nil, let legacyCookie = String(data: data, encoding: .utf8) {
                credential = StoredCredential(cookie: legacyCookie, expiresAt: nil)
            }
        }
    }

    public func validCookie(now: Date = Date()) -> String? {
        guard let credential else { return nil }
        if let expiresAt = credential.expiresAt, expiresAt <= now {
            clear()
            return nil
        }
        return credential.cookie
    }

    public func update(setCookie: String, url: URL) throws {
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: ["Set-Cookie": setCookie], for: url)
        guard let cookie = cookies.first else { return }
        guard cookie.expiresDate.map({ $0 > Date() }) ?? true else {
            clear()
            return
        }
        let stored = StoredCredential(cookie: "\(cookie.name)=\(cookie.value)", expiresAt: cookie.expiresDate)
        let data = try JSONEncoder().encode(stored)
        try SecureValueStore.save(data, service: service, account: account)
        credential = stored
    }

    public func clear() {
        credential = nil
        SecureValueStore.delete(service: service, account: account)
    }
}

/// Namespace marker for the build-time generated WearBloom API client.
public enum WearBloomGeneratedContract {
    public static func client(
        serverURL: URL,
        credentials: APISessionCredentialStore,
        integrityProvider: (any RequestIntegrityProvider)? = nil,
        transport: any ClientTransport = URLSessionTransport()
    ) -> Client {
        var middlewares: [any ClientMiddleware] = [SessionMiddleware(credentials: credentials)]
        if let integrityProvider {
            middlewares.append(IntegrityMiddleware(provider: integrityProvider))
        }
        return Client(serverURL: serverURL, transport: transport, middlewares: middlewares)
    }
}

private struct SessionMiddleware: ClientMiddleware {
    let credentials: APISessionCredentialStore

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let cookie = await credentials.validCookie() {
            request.headerFields[.cookie] = cookie
        }
        let result = try await next(request, body, baseURL)
        if let setCookie = result.0.headerFields[.setCookie] {
            try await credentials.update(setCookie: setCookie, url: baseURL)
        }
        if result.0.status == .unauthorized {
            await credentials.clear()
            throw ContractTransportError.sessionExpired
        }
        return result
    }
}

private struct IntegrityMiddleware: ClientMiddleware {
    let provider: any RequestIntegrityProvider

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard operationID == "uploadImage" || operationID == "createRender" else {
            return try await next(request, body, baseURL)
        }
        let bytes: [UInt8]
        if let body {
            bytes = try await [UInt8](collecting: body, upTo: 13 * 1024 * 1024)
        } else {
            bytes = []
        }
        let data = Data(bytes)
        let path = operationID == "uploadImage" ? "/v1/uploads" : "/v1/renders"
        let headers = try await provider.headers(method: request.method.rawValue, path: path, body: data)
        var protectedRequest = request
        for (name, value) in headers {
            guard let fieldName = HTTPField.Name(name) else { continue }
            protectedRequest.headerFields[fieldName] = value
        }
        return try await next(protectedRequest, HTTPBody(data), baseURL)
    }
}
