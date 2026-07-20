import SwiftUI

struct OnboardingView: View {
    let completion: () -> Void
    @State private var page = 0

    var body: some View {
        ZStack {
            BloomColor.cream.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    BloomWordmark()
                    Spacer()
                    if page < 2 {
                        Button("Skip") { completion() }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(BloomColor.muted)
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 12)

                TabView(selection: $page) {
                    OnboardingPage(
                        title: "Style what you own.",
                        detail: "Build an outfit, then see it on you.",
                        artwork: .closet
                    )
                    .tag(0)
                    OnboardingPage(
                        title: "One photo is enough.",
                        detail: "A clear, full-length photo gives the best preview.",
                        artwork: .photo
                    )
                    .tag(1)
                    OnboardingPage(
                        title: "Private by default.",
                        detail: "Your photos are only shared when you choose.",
                        artwork: .privacy
                    )
                    .tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                HStack(spacing: 7) {
                    ForEach(0..<3, id: \.self) { index in
                        Circle()
                            .fill(index == page ? BloomColor.ink : BloomColor.ink.opacity(0.15))
                            .frame(width: 7, height: 7)
                    }
                }
                .padding(.bottom, 18)

                Button {
                    if page < 2 {
                        Telemetry.event("onboarding_step_completed", properties: ["step": page + 1])
                        withAnimation(.smooth) { page += 1 }
                    } else {
                        Telemetry.event("onboarding_completed")
                        completion()
                    }
                } label: {
                    Text(page == 2 ? "Get started" : "Continue")
                }
                .buttonStyle(BloomButtonStyle(fill: BloomColor.violet))
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
            }
        }
    }
}

private struct OnboardingPage: View {
    enum Artwork { case closet, photo, privacy }
    let title: LocalizedStringKey
    let detail: LocalizedStringKey
    let artwork: Artwork

    var body: some View {
        VStack(spacing: 28) {
            artworkView
                .frame(maxWidth: .infinity)
                .frame(height: 410)
                .padding(.horizontal, 22)

            VStack(spacing: 10) {
                Text(title)
                    .font(.system(size: 34, weight: .bold))
                    .tracking(-1.1)
                    .multilineTextAlignment(.center)
                Text(detail)
                    .font(.system(size: 17))
                    .foregroundStyle(BloomColor.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 30)
        }
        .padding(.top, 22)
    }

    @ViewBuilder private var artworkView: some View {
        switch artwork {
        case .closet:
            ClosetArtwork()
        case .photo:
            PhotoArtwork()
        case .privacy:
            PrivacyArtwork()
        }
    }
}

private struct ClosetArtwork: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 36, style: .continuous)
                .fill(BloomColor.violet)
            Circle()
                .fill(BloomColor.lime)
                .frame(width: 210)
                .offset(x: -105, y: -110)
            VStack(spacing: -16) {
                OnboardingGarment(symbol: "tshirt.fill", color: .white, rotation: -5)
                OnboardingGarment(symbol: "jacket.fill", color: BloomColor.lime, rotation: 5)
            }
            .offset(x: 55, y: 12)
            Image(systemName: "figure.stand.dress")
                .font(.system(size: 190, weight: .ultraLight))
                .foregroundStyle(.white)
                .offset(x: -70, y: 55)
        }
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
    }
}

private struct OnboardingGarment: View {
    let symbol: String
    let color: Color
    let rotation: Double

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 52, weight: .medium))
            .foregroundStyle(BloomColor.ink)
            .frame(width: 132, height: 132)
            .background(color, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .rotationEffect(.degrees(rotation))
            .shadow(color: .black.opacity(0.12), radius: 18, y: 8)
    }
}

private struct PhotoArtwork: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 36, style: .continuous)
                .fill(BloomColor.softViolet)
            OrganicBlob()
                .fill(BloomColor.coral)
                .frame(width: 320, height: 330)
                .offset(x: -65, y: 10)
            Image(systemName: "figure.stand.dress")
                .font(.system(size: 245, weight: .ultraLight))
                .foregroundStyle(BloomColor.ink)
            Image(systemName: "camera.fill")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(BloomColor.ink)
                .frame(width: 64, height: 64)
                .background(BloomColor.lime, in: Circle())
                .offset(x: 115, y: -130)
        }
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
    }
}

private struct PrivacyArtwork: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 36, style: .continuous)
                .fill(BloomColor.ink)
            Circle()
                .fill(BloomColor.violet)
                .frame(width: 270)
            Image(systemName: "lock.fill")
                .font(.system(size: 78, weight: .semibold))
                .foregroundStyle(BloomColor.lime)
            Image(systemName: "photo.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(BloomColor.violet)
                .frame(width: 54, height: 54)
                .background(.white, in: Circle())
                .offset(x: -115, y: 115)
            Image(systemName: "heart.fill")
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(BloomColor.coral)
                .frame(width: 54, height: 54)
                .background(.white, in: Circle())
                .offset(x: 118, y: -105)
        }
        .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
    }
}
