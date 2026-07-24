import AuthenticationServices
import CryptoKit
import Security
import SwiftData
import SwiftUI

struct SettingsView: View {
    @Environment(AppSession.self) private var session
    @Environment(SubscriptionManager.self) private var subscriptions
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(\.openURL) private var openURL
    @Query private var garments: [Garment]
    @Query private var looks: [Look]
    @Query private var references: [ReferencePhoto]
    @State private var isDeleteConfirmationPresented = false
    @State private var isDeletingAccount = false
    @AppStorage(PrivacyChoices.diagnosticsConsentKey) private var diagnosticsConsent = false
    @State private var appleNonce: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        ZStack {
                            Circle().fill(subscriptions.isPro ? BloomColor.lime : BloomColor.violet)
                            Image(systemName: subscriptions.isPro ? "sparkles" : "person.fill")
                                .foregroundStyle(subscriptions.isPro ? BloomColor.ink : .white)
                        }
                        .frame(width: 52, height: 52)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(subscriptions.isPro ? String(localized: "WearBloom Pro") : String(localized: "Your WearBloom"))
                                .font(BloomTypography.heading)
                            Text(subscriptions.isPro
                                ? String(localized: "Pro generation is active")
                                : String(localized: "\(session.freeRendersRemaining) free renders remaining"))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Section("Account") {
                    if session.hasLinkedAppleAccount {
                        Label("Secured with Apple", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(BloomColor.violet)
                    } else {
                        SignInWithAppleButton(.continue) { request in
                            let nonce = AppleNonce.make()
                            appleNonce = nonce
                            request.requestedScopes = [.email]
                            request.nonce = AppleNonce.sha256(nonce)
                        } onCompletion: { result in
                            handleAppleSignIn(result)
                        }
                        .signInWithAppleButtonStyle(.black)
                        .frame(height: 48)
                    }
                }
                Section("Membership") {
                    if !subscriptions.isPro {
                        Button("View plans", systemImage: "sparkles") { session.isPaywallPresented = true }
                    }
                    Button("Restore purchases", systemImage: "arrow.clockwise") {
                        Task { await subscriptions.restorePurchases() }
                    }
                    Link(
                        "Manage App Store subscription",
                        destination: URL(string: "https://apps.apple.com/account/subscriptions")!
                    )
                    Link(
                        "Subscription and support",
                        destination: URL(string: "https://wearbloom.app/support.html")!
                    )
                }
                Section("Your library") {
                    LabeledContent("Garments", value: "\(garments.count)")
                    LabeledContent("Looks", value: "\(looks.count)")
                    LabeledContent("Reference photos", value: "\(references.count)")
                    NavigationLink("Manage reference photos") { ManageReferencesView() }
                }
                Section("Privacy") {
                    Label("Photos are private by default", systemImage: "lock.fill")
                    NavigationLink("How WearBloom uses photos") {
                        PrivacyView()
                    }

                    NavigationLink {
                        AIProcessingPrivacySettingsView()
                    } label: {
                        PrivacySettingLabel(
                            title: String(localized: "AI photo processing"),
                            systemImage: "wand.and.stars",
                            isEnabled: session.hasAIProcessingConsent
                        )
                    }

                    NavigationLink {
                        DiagnosticsPrivacySettingsView()
                    } label: {
                        PrivacySettingLabel(
                            title: String(localized: "Share diagnostics and usage"),
                            systemImage: "waveform.path.ecg",
                            isEnabled: diagnosticsConsent
                        )
                    }
                    Button("Delete account and data", systemImage: "trash", role: .destructive) {
                        isDeleteConfirmationPresented = true
                    }
                    .disabled(isDeletingAccount)
                }
                Section("About") {
                    LabeledContent("Version", value: appVersion)
                    Link("Help and support", destination: URL(string: "https://wearbloom.app/support.html")!)
                    Link("Privacy policy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
                    Link("Terms of use", destination: URL(string: "https://wearbloom.app/terms.html")!)
                }
            }
            .tint(BloomColor.violet)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .confirmationDialog(
                "Delete your WearBloom account?",
                isPresented: $isDeleteConfirmationPresented,
                titleVisibility: .visible
            ) {
                Button("Delete account now", role: .destructive) { Task { await deleteAllData() } }
                Button("Manage subscription") {
                    openURL(URL(string: "https://apps.apple.com/account/subscriptions")!)
                }
            } message: {
                Text("This permanently deletes your account, private files, garments, photos, looks, and previews. Any App Store subscription continues until you cancel it with Apple.")
            }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "\(version) (\(build))"
    }

    private func deleteAllData() async {
        guard !isDeletingAccount else { return }
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        do {
            try await RemoteLibraryCoordinator.shared.deleteAccount()
        } catch {
            Telemetry.error(error, context: ["operation": "account_delete"])
            if case let APIClientError.server(code, _) = error, code == "APPLE_REAUTH_REQUIRED" {
                session.hasLinkedAppleAccount = false
                UserDefaults.standard.set(false, forKey: "hasLinkedAppleAccount")
                session.showToast(String(localized: "Continue with Apple again, then retry deletion."))
            } else {
                session.showToast(String(localized: "Remote deletion could not be confirmed. Please try again."))
            }
            return
        }
        for look in looks { modelContext.delete(look) }
        for garment in garments { modelContext.delete(garment) }
        for reference in references { modelContext.delete(reference) }
        guard modelContext.saveReporting(operation: "account_local_delete") else {
            modelContext.rollback()
            session.showToast(String(localized: "Your account was deleted remotely, but local cleanup failed. Restart WearBloom to retry."))
            return
        }
        session.resetAfterAccountDeletion()
        subscriptions.clearAccount()
        Telemetry.event("account_data_deleted")
        Telemetry.resetIdentity()
        Telemetry.setCollectionEnabled(false, syncWithServer: false)
        dismiss()
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        guard case let .success(authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let codeData = credential.authorizationCode,
              let authorizationCode = String(data: codeData, encoding: .utf8),
              let nonce = appleNonce else {
            if case let .failure(error) = result {
                Telemetry.error(error, context: ["operation": "apple_sign_in"])
            }
            return
        }
        Task {
            do {
                let status = try await RemoteLibraryCoordinator.shared.linkAppleAccount(
                    identityToken: token,
                    authorizationCode: authorizationCode,
                    nonce: nonce
                )
                session.apply(status)
                await Telemetry.synchronizeServerPreference(userID: status.userId)
                await subscriptions.configureAccount(
                    appAccountToken: status.appAccountToken,
                    isPro: status.isPro
                )
                session.hasLinkedAppleAccount = true
                UserDefaults.standard.set(true, forKey: "hasLinkedAppleAccount")
                Telemetry.event("apple_account_linked")
                session.showToast(String(localized: "Your library is secured with Apple."))
            } catch {
                Telemetry.error(error, context: ["operation": "apple_sign_in"])
                session.showToast(error.localizedDescription)
            }
        }
    }
}

private enum AppleNonce {
    static func make(length: Int = 32) -> String {
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            return UUID().uuidString
        }
        return String(bytes.map { characters[Int($0) % characters.count] })
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

private struct ManageReferencesView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ReferencePhoto.createdAt, order: .reverse) private var references: [ReferencePhoto]

    var body: some View {
        List {
            ForEach(references) { reference in
                HStack(spacing: 12) {
                    ImageDataView(data: reference.imageData)
                        .frame(width: 58, height: 72).clipped().clipShape(RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(reference.name).font(BloomTypography.bodyMedium)
                        Text(reference.isGeneratedReference ? String(localized: "Generated reference") : String(localized: "Personal photo"))
                            .font(BloomTypography.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if reference.isDefault { Text("DEFAULT").font(BloomTypography.technicalSmall).foregroundStyle(BloomColor.violet) }
                }
                .swipeActions(edge: .leading) {
                    Button("Default") { makeDefault(reference) }
                        .tint(BloomColor.violet)
                }
            }
            .onDelete(perform: deleteReferences)
        }
        .navigationTitle("Reference photos")
    }

    private func makeDefault(_ reference: ReferencePhoto) {
        for item in references {
            item.isDefault = item.id == reference.id
        }
        guard modelContext.saveReporting(operation: "reference_default_save") else {
            modelContext.rollback()
            session.showToast(String(localized: "Couldn’t update the default reference."))
            return
        }
        syncDefault(reference)
    }

    private func deleteReferences(at offsets: IndexSet) {
        for index in offsets {
            let reference = references[index]
            let id = reference.id
            SynchronizedDeletion.perform(
                operation: "reference_delete",
                remote: { try await RemoteLibraryCoordinator.shared.deleteReference(id) },
                local: {
                    modelContext.delete(reference)
                    try modelContext.saveIfNeeded()
                },
                onFailure: { session.showToast(String(localized: "Couldn’t delete this reference. Please try again.")) }
            )
        }
    }

    private func syncDefault(_ reference: ReferencePhoto) {
        guard let imageData = reference.imageData else { return }
        Task { @MainActor in
            guard await RemoteLibraryCoordinator.shared.isConfigured else { return }
            do {
                reference.remoteAssetID = try await RemoteLibraryCoordinator.shared.saveReference(
                    RemoteReferenceInput(
                        id: reference.id,
                        imageData: imageData,
                        remoteAssetID: reference.remoteAssetID,
                        isGenerated: reference.isGeneratedReference,
                        generatedFromVariantID: reference.generatedFromVariantID
                    ),
                    isDefault: true
                )
                modelContext.saveReporting(operation: "reference_default_sync_save")
            } catch {
                Telemetry.error(error, context: ["operation": "reference_default_sync"])
            }
        }
    }
}
