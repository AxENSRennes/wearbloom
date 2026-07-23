import SwiftUI

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
                        .font(.system(size: 30, weight: .bold))
                    Text("To create a preview, WearBloom uploads the reference photo and garment photos you selected to our private servers and shares them with OpenAI, our AI image provider.")
                    Text("The photos are used to classify garments and create your requested preview. They are not used for advertising or cross-app tracking. You can withdraw permission in Settings and delete stored photos and account data at any time.")
                        .foregroundStyle(.secondary)
                    Link("Read the privacy policy", destination: URL(string: "https://wearbloom.app/privacy.html")!)
                        .fontWeight(.semibold)
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
