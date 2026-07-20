import AuthenticationServices
import CryptoKit
import RevenueCatUI
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
    @State private var isCustomerCenterPresented = false
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
                            Text(subscriptions.isPro ? "WearBloom Pro" : "Your WearBloom")
                                .font(.system(size: 19, weight: .semibold))
                            Text(subscriptions.isPro ? "Pro generation is active" : "\(session.freeRendersRemaining) free renders remaining")
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
                    Button("Subscription and support", systemImage: "person.text.rectangle") {
                        isCustomerCenterPresented = true
                    }
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
                    Toggle(
                        "Allow AI photo processing",
                        isOn: Binding(
                            get: { session.hasAIProcessingConsent },
                            set: { session.setAIProcessingConsent($0) }
                        )
                    )
                    Toggle(
                        "Share diagnostics and usage",
                        isOn: Binding(
                            get: { diagnosticsConsent },
                            set: {
                                diagnosticsConsent = $0
                                Telemetry.setCollectionEnabled($0)
                            }
                        )
                    )
                    Text("AI processing shares only selected photos with OpenAI for the preview you request. Optional diagnostics and usage go to Sentry and PostHog; they never include your photos.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
            .sheet(isPresented: $isCustomerCenterPresented) {
                CustomerCenterView()
                    .onCustomerCenterRestoreCompleted { subscriptions.update($0) }
                    .onCustomerCenterRestoreFailed { subscriptions.report($0) }
            }
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
            try await WearBloomAPI.shared.deleteAccount()
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
        try? modelContext.save()
        session.resetDraft()
        session.hasLinkedAppleAccount = false
        UserDefaults.standard.set(false, forKey: "hasLinkedAppleAccount")
        await subscriptions.logOut()
        Telemetry.event("account_data_deleted")
        Telemetry.resetIdentity()
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
                try await WearBloomAPI.shared.signInWithApple(
                    identityToken: token,
                    authorizationCode: authorizationCode,
                    nonce: nonce
                )
                let status = try await WearBloomAPI.shared.accountStatus()
                session.apply(status)
                Telemetry.identify(userID: status.userId)
                await subscriptions.logIn(appUserID: status.userId)
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
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \ReferencePhoto.createdAt, order: .reverse) private var references: [ReferencePhoto]

    var body: some View {
        List {
            ForEach(references) { reference in
                HStack(spacing: 12) {
                    ImageDataView(data: reference.imageData)
                        .frame(width: 58, height: 72).clipped().clipShape(RoundedRectangle(cornerRadius: 10))
                    VStack(alignment: .leading, spacing: 3) {
                        Text(reference.name).fontWeight(.semibold)
                        Text(reference.isGeneratedReference ? "Generated reference" : "Personal photo")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if reference.isDefault { Text("DEFAULT").font(.caption2.bold()).foregroundStyle(BloomColor.violet) }
                }
                .swipeActions(edge: .leading) {
                    Button("Default") {
                        for item in references { item.isDefault = item.id == reference.id }
                    }.tint(BloomColor.violet)
                }
            }
            .onDelete { offsets in
                for index in offsets {
                    let reference = references[index]
                    let id = reference.id
                    modelContext.delete(reference)
                    Task {
                        do { try await WearBloomAPI.shared.deleteReference(id) }
                        catch { Telemetry.error(error, context: ["operation": "reference_delete"]) }
                    }
                }
                try? modelContext.save()
            }
        }
        .navigationTitle("Reference photos")
    }
}

private struct PrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 54)).foregroundStyle(BloomColor.violet)
                Text("Your photos stay private")
                    .font(.system(size: 30, weight: .bold))
                Text("Your working library is stored on this device. Photos selected for a preview are uploaded privately and never made public unless you share them.")
                Text("With your permission, selected reference and garment photos are shared with OpenAI to classify garments and create the preview you request. You can withdraw that permission in Settings.")
                Text("Optional product analytics and diagnostics are shared with PostHog and Sentry only if you opt in. WearBloom does not include photos or prompts in analytics.")
                Text("Deleting your account removes its associated records and private files. App Store subscription cancellation is managed separately through Apple.")
                Text("Previews are style inspiration—not a prediction of exact fit or sizing.")
            }
            .font(.system(size: 16))
            .lineSpacing(4)
            .padding(22)
        }
        .background(BloomColor.cream)
        .navigationTitle("Photo privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
