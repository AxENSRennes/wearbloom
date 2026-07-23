import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing
@testable import WearBloomContract

@Suite("Generated client transport")
struct TransportTests {
    @Test("session middleware injects and rotates the cookie")
    func sessionCookieRotation() async throws {
        let service = "app.wearbloom.tests.\(UUID().uuidString)"
        let credentials = APISessionCredentialStore(service: service, account: "session")
        defer { SecureValueStore.delete(service: service, account: "session") }
        let baseURL = URL(string: "https://api.wearbloom.test")!
        try await credentials.update(setCookie: "session=old; Max-Age=3600; Path=/; HttpOnly", url: baseURL)
        let transport = RecordingTransport(
            response: HTTPResponse(
                status: .ok,
                headerFields: [.contentType: "application/json", .setCookie: "session=new; Max-Age=3600; Path=/; HttpOnly"]
            ),
            body: HTTPBody(#"{"challenge":"00000000-0000-4000-8000-000000000001"}"#)
        )
        let client = WearBloomGeneratedContract.client(
            serverURL: baseURL,
            credentials: credentials,
            transport: transport
        )

        _ = try await client.getAttestChallenge().ok

        #expect(await transport.cookie == "session=old")
        #expect(await credentials.validCookie() == "session=new")
    }

    @Test("an unauthorized response clears the persisted session")
    func unauthorizedClearsSession() async throws {
        let service = "app.wearbloom.tests.\(UUID().uuidString)"
        let credentials = APISessionCredentialStore(service: service, account: "session")
        defer { SecureValueStore.delete(service: service, account: "session") }
        let baseURL = URL(string: "https://api.wearbloom.test")!
        try await credentials.update(setCookie: "session=old; Max-Age=3600; Path=/", url: baseURL)
        let transport = RecordingTransport(response: HTTPResponse(status: .unauthorized), body: nil)
        let client = WearBloomGeneratedContract.client(
            serverURL: baseURL,
            credentials: credentials,
            transport: transport
        )

        do {
            _ = try await client.getAttestChallenge()
            Issue.record("Expected the generated client to surface a session error")
        } catch {
            #expect(ContractTransportError.isSessionExpired(error))
        }
        #expect(await credentials.validCookie() == nil)
    }

    @Test("integrity middleware signs and replays the exact encoded multipart body")
    func integrityBodyBinding() async throws {
        let service = "app.wearbloom.tests.\(UUID().uuidString)"
        let credentials = APISessionCredentialStore(service: service, account: "session")
        defer { SecureValueStore.delete(service: service, account: "session") }
        let provider = RecordingIntegrityProvider()
        let responseJSON = #"{"id":"00000000-0000-4000-8000-000000000002","contentType":"image/jpeg","width":100,"height":100}"#
        let transport = RecordingTransport(
            response: HTTPResponse(status: .created, headerFields: [.contentType: "application/json"]),
            body: HTTPBody(responseJSON)
        )
        let client = WearBloomGeneratedContract.client(
            serverURL: URL(string: "https://api.wearbloom.test")!,
            credentials: credentials,
            integrityProvider: provider,
            transport: transport
        )
        typealias Part = Operations.UploadImage.Input.Body.MultipartFormPayload
        let multipart: MultipartBody<Part> = [
            .image(.init(payload: .init(body: HTTPBody(Data([1, 2, 3]))), filename: "image.jpg")),
            .purpose(.init(payload: .init(body: HTTPBody("garment"))))
        ]

        _ = try await client.uploadImage(body: .multipartForm(multipart)).created

        #expect(await provider.body == transport.requestBody)
        #expect(await provider.path == "/v1/uploads")
        #expect(await transport.integrityHeader == "signed")
    }
}

private actor RecordingTransport: ClientTransport {
    let response: HTTPResponse
    let responseBody: HTTPBody?
    private(set) var cookie: String?
    private(set) var requestBody: Data?
    private(set) var integrityHeader: String?

    init(response: HTTPResponse, body: HTTPBody?) {
        self.response = response
        responseBody = body
    }

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        cookie = request.headerFields[.cookie]
        integrityHeader = request.headerFields[HTTPField.Name("X-App-Attest-Assertion")!]
        if let body {
            requestBody = Data(try await [UInt8](collecting: body, upTo: 13 * 1024 * 1024))
        }
        return (response, responseBody)
    }
}

private actor RecordingIntegrityProvider: RequestIntegrityProvider {
    private(set) var body: Data?
    private(set) var path: String?

    func headers(method: String, path: String, body: Data) async throws -> [String: String] {
        self.body = body
        self.path = path
        return ["X-App-Attest-Assertion": "signed"]
    }
}
