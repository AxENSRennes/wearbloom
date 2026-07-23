import Foundation
import SwiftData

extension ModelContext {
    func saveIfNeeded() throws {
        if hasChanges { try save() }
    }

    @discardableResult
    func saveReporting(operation: String = "swiftdata_save") -> Bool {
        do {
            try saveIfNeeded()
            return true
        } catch {
            Telemetry.error(error, context: ["operation": operation])
            return false
        }
    }
}

@MainActor
enum SynchronizedDeletion {
    static func perform(
        operation: String,
        remote: @escaping @Sendable () async throws -> Void,
        local: @escaping @MainActor () throws -> Void,
        onFailure: (@MainActor () -> Void)? = nil
    ) {
        Task {
            do {
                try await remote()
                try local()
            } catch {
                Telemetry.error(error, context: ["operation": operation])
                onFailure?()
            }
        }
    }
}
