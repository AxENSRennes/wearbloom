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
    @Query private var garments: [Garment]
    @Query private var looks: [Look]
    @Query private var references: [ReferencePhoto]
    @State private var isCustomerCenterPresented = false
    @State private var isDeletingData = false
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
                                .font(.system(size: 20, weight: .black, design: .serif))
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
                    Text("Apple sign-in is optional. It protects your library across sessions without exposing your photo content.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Section("Membership") {
                    if !subscriptions.isPro {
                        Button("View plans", systemImage: "sparkles") { session.isPaywallPresented = true }
                    }
                    Button("Restore purchases", systemImage: "arrow.clockwise") {
                        Task { await subscriptions.restorePurchases() }
                    }
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
                    Button("Delete my data", systemImage: "trash", role: .destructive) {
                        isDeletingData = true
                    }
                }
                Section("About") {
                    LabeledContent("Version", value: "1.0")
                    Link("Privacy policy", destination: URL(string: "https://wearbloom.app/privacy")!)
                    Link("Terms", destination: URL(string: "https://wearbloom.app/terms")!)
                }
            }
            .tint(BloomColor.violet)
            .navigationTitle("Profile & settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: $isCustomerCenterPresented) {
                CustomerCenterView()
                    .onCustomerCenterRestoreCompleted { subscriptions.update($0) }
                    .onCustomerCenterRestoreFailed { subscriptions.report($0) }
            }
            .confirmationDialog(
                "Delete all WearBloom data?",
                isPresented: $isDeletingData,
                titleVisibility: .visible
            ) {
                Button("Delete all data", role: .destructive) { Task { await deleteAllData() } }
            } message: {
                Text("This permanently deletes your local garments, photos, looks, and variants. It does not cancel an App Store subscription.")
            }
        }
    }

    private func deleteAllData() async {
        do {
            try await WearBloomAPI.shared.deleteAccount()
        } catch {
            Telemetry.error(error, context: ["operation": "account_delete"])
            session.showToast(String(localized: "Remote deletion could not be confirmed. Please try again."))
            return
        }
        for look in looks { modelContext.delete(look) }
        for garment in garments { modelContext.delete(garment) }
        for reference in references { modelContext.delete(reference) }
        try? modelContext.save()
        session.resetDraft()
        session.hasLinkedAppleAccount = false
        UserDefaults.standard.set(false, forKey: "hasLinkedAppleAccount")
        Telemetry.event("account_data_deleted")
        dismiss()
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        guard case let .success(authorization) = result,
              let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = appleNonce else {
            if case let .failure(error) = result {
                Telemetry.error(error, context: ["operation": "apple_sign_in"])
            }
            return
        }
        Task {
            do {
                try await WearBloomAPI.shared.signInWithApple(identityToken: token, nonce: nonce)
                let status = try await WearBloomAPI.shared.accountStatus()
                session.apply(status)
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
                for index in offsets { modelContext.delete(references[index]) }
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
                Text("Private by design")
                    .font(.system(size: 34, weight: .black, design: .serif))
                Text("WearBloom stores your working library locally on this device. When production generation is connected, selected images are uploaded privately for that request and are never made public unless you explicitly choose to share.")
                Text("Deleting a look or account requests cleanup of associated business records and files. Analytics must never include photos, prompts, free-form notes, tokens, or secrets.")
                Text("An on-device preview is labeled clearly. It is not an exact prediction of fit, sizing, drape, or body shape.")
            }
            .font(.system(size: 16, design: .rounded))
            .lineSpacing(4)
            .padding(22)
        }
        .background(BloomColor.cream)
        .navigationTitle("Photo privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
