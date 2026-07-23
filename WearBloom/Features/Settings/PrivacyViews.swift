import SwiftUI

struct PrivacySettingLabel: View {
    let title: String
    let systemImage: String
    let isEnabled: Bool

    var body: some View {
        HStack(spacing: 12) {
            Label(title, systemImage: systemImage)
            Spacer()
            Text(isEnabled ? String(localized: "On") : String(localized: "Off"))
                .font(BloomTypography.technical)
                .foregroundStyle(isEnabled ? BloomColor.blue : BloomColor.muted)
        }
    }
}

struct AIProcessingPrivacySettingsView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        Form {
            Section {
                Toggle(
                    "Allow AI photo processing",
                    isOn: Binding(
                        get: { session.hasAIProcessingConsent },
                        set: { session.setAIProcessingConsent($0) }
                    )
                )
            } footer: {
                Text("This is on by default so WearBloom can create previews. Turn it off at any time to prevent new photo uploads for AI processing.")
            }

            Section("What is shared") {
                Text("Only the reference photo and garment photos you select for a preview are uploaded to our private servers and shared with OpenAI, our AI image provider.")
                Text("Photos are used to classify garments and create the preview you request. They are not used for advertising or cross-app tracking.")
                Link("Read the privacy policy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
            }
        }
        .tint(BloomColor.blue)
        .navigationTitle("AI photo processing")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct DiagnosticsPrivacySettingsView: View {
    @AppStorage(PrivacyChoices.diagnosticsConsentKey) private var diagnosticsConsent = true

    var body: some View {
        Form {
            Section {
                Toggle("Share diagnostics and usage", isOn: $diagnosticsConsent)
                    .onChange(of: diagnosticsConsent) { _, enabled in
                        Telemetry.setCollectionEnabled(enabled)
                    }
            } footer: {
                Text("This is on by default to help improve WearBloom. You can turn it off at any time.")
            }

            Section("What is shared") {
                Text("Product usage is shared with PostHog and technical errors with Sentry. Diagnostics never include your photos or prompts.")
                Text("WearBloom disables collection as soon as you turn this setting off.")
            }
        }
        .tint(BloomColor.blue)
        .navigationTitle("Diagnostics and usage")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AIProcessingConsentView: View {
    @Environment(\.dismiss) private var dismiss
    let primaryActionTitle: String
    let consent: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Image(systemName: "wand.and.stars.inverse")
                        .font(.system(size: 52))
                        .foregroundStyle(BloomColor.violet)
                    Text("Allow AI photo processing?")
                        .font(BloomTypography.modalTitle)
                    Text("To create a preview, WearBloom uploads the reference photo and garment photos you selected to our private servers and shares them with OpenAI, our AI image provider.")
                    Text("The photos are used to classify garments and create your requested preview. They are not used for advertising or cross-app tracking. You can withdraw permission in Settings and delete stored photos and account data at any time.")
                        .foregroundStyle(.secondary)
                    Link("Read the privacy policy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
                        .font(BloomTypography.bodyMedium)
                    Button(primaryActionTitle) {
                        consent()
                        dismiss()
                    }
                    .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
                    Button("Not now") { dismiss() }
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(BloomColor.muted)
                }
                .padding(22)
            }
            .background(BloomColor.cream)
            .navigationTitle("AI processing")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
struct PrivacyView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 54)).foregroundStyle(BloomColor.violet)
                Text("Your photos stay private")
                    .font(BloomTypography.modalTitle)
                Text("Your working library is stored on this device. Photos selected for a preview are uploaded privately and never made public unless you share them.")
                Text("With your permission, selected reference and garment photos are shared with OpenAI to classify garments and create the preview you request. You can withdraw that permission in Settings.")
                Text("Product analytics and diagnostics are enabled by default and can be turned off in Settings. WearBloom does not include photos or prompts in analytics.")
                Text("Deleting your account removes its associated records and private files. App Store subscription cancellation is managed separately through Apple.")
                Text("Previews are style inspiration—not a prediction of exact fit or sizing.")
            }
            .font(BloomTypography.callout)
            .lineSpacing(4)
            .padding(22)
        }
        .background(BloomColor.cream)
        .navigationTitle("Photo privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}
