import Foundation
import HTTPTypes
import OpenAPIRuntime
import OpenAPIURLSession

/// Namespace marker for the build-time generated WearBloom API client.
public enum WearBloomGeneratedContract {
    public static func client(serverURL: URL, cookie: String? = nil) -> Client {
        let middleware = CookieMiddleware(cookie: cookie)
        return Client(
            serverURL: serverURL,
            transport: URLSessionTransport(),
            middlewares: [middleware]
        )
    }
}

private struct CookieMiddleware: ClientMiddleware {
    let cookie: String?

    func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let cookie, !cookie.isEmpty {
            request.headerFields[.cookie] = cookie
        }
        return try await next(request, body, baseURL)
    }
}
