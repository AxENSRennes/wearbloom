import SwiftUI

struct OnboardingView: View {
    let completion: () -> Void
    @State private var page = 0

    var body: some View {
        ZStack {
            BloomColor.cream.ignoresSafeArea()
            TabView(selection: $page) {
                OnboardingPage(
                    eyebrow: "YOUR CLOSET, IN MOTION",
                    title: "Make the look.\nSee the energy.",
                    detail: "Combine pieces you own, then create a personal preview that helps you decide.",
                    accent: BloomColor.violet,
                    artwork: .collage
                )
                .tag(0)
                OnboardingPage(
                    eyebrow: "ONE PHOTO IS ENOUGH",
                    title: "Start with you,\nnot a stock model.",
                    detail: "A clear, full-length photo works best. You can add more references whenever you like.",
                    accent: BloomColor.coral,
                    artwork: .figure
                )
                .tag(1)
                OnboardingPage(
                    eyebrow: "PRIVATE BY DEFAULT",
                    title: "Your photos stay\nyours. Full stop.",
                    detail: "Nothing becomes public unless you explicitly share it. Failed generations never count.",
                    accent: BloomColor.lime,
                    artwork: .privacy
                )
                .tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 18) {
                HStack(spacing: 7) {
                    ForEach(0..<3, id: \.self) { index in
                        Capsule()
                            .fill(index == page ? BloomColor.ink : BloomColor.ink.opacity(0.18))
                            .frame(width: index == page ? 28 : 7, height: 7)
                    }
                }
                Button {
                    if page < 2 {
                        Telemetry.event("onboarding_step_completed", properties: ["step": page + 1])
                        withAnimation(.smooth) { page += 1 }
                    } else {
                        Telemetry.event("onboarding_completed")
                        completion()
                    }
                } label: {
                    HStack {
                        Text(page == 2 ? "Build my first look" : "Keep going")
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(BloomButtonStyle())
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
            .background(BloomColor.cream)
        }
    }
}

private struct OnboardingPage: View {
    enum Artwork { case collage, figure, privacy }
    let eyebrow: LocalizedStringKey
    let title: LocalizedStringKey
    let detail: LocalizedStringKey
    let accent: Color
    let artwork: Artwork

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                BloomWordmark().padding(.top, 18)
                SectionEyebrow(text: eyebrow).padding(.top, 10)
                Text(title)
                    .font(.system(size: 46, weight: .black, design: .serif))
                    .tracking(-2.1)
                    .lineSpacing(-4)
                    .foregroundStyle(BloomColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail)
                    .font(.system(size: 17, weight: .medium, design: .rounded))
                    .foregroundStyle(BloomColor.muted)
                    .lineSpacing(3)
                artworkView
                    .frame(height: 340)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
    }

    @ViewBuilder private var artworkView: some View {
        ZStack {
            OrganicBlob().fill(accent).rotationEffect(.degrees(-4))
            switch artwork {
            case .collage:
                CollageArtwork()
            case .figure:
                FigureArtwork()
            case .privacy:
                PrivacyArtwork()
            }
        }
    }
}

private struct CollageArtwork: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 32)
                .fill(BloomColor.coral)
                .frame(width: 170, height: 245)
                .overlay(Image(systemName: "figure.stand").font(.system(size: 115, weight: .light)))
                .rotationEffect(.degrees(-7))
                .offset(x: -65, y: 15)
            ForEach(Array(zip(["tshirt.fill", "jacket.fill", "figure.dress.line.vertical.figure"], [BloomColor.paper, BloomColor.lime, BloomColor.paper]).enumerated()), id: \.offset) { index, item in
                RoundedRectangle(cornerRadius: 23)
                    .fill(item.1)
                    .frame(width: 125, height: 125)
                    .overlay(Image(systemName: item.0).font(.system(size: 54)).foregroundStyle(index == 1 ? BloomColor.ink : BloomColor.violet))
                    .overlay(RoundedRectangle(cornerRadius: 23).stroke(BloomColor.ink, lineWidth: 2))
                    .shadow(color: BloomColor.ink, radius: 0, x: 5, y: 5)
                    .rotationEffect(.degrees(Double(index * 5) - 4))
                    .offset(x: 82, y: CGFloat(index * 92) - 86)
            }
        }
        .foregroundStyle(BloomColor.ink)
    }
}

private struct FigureArtwork: View {
    var body: some View {
        ZStack {
            Circle().fill(BloomColor.lime).frame(width: 220).offset(x: -55, y: -15)
            Image(systemName: "figure.stand.dress")
                .font(.system(size: 220, weight: .ultraLight))
                .foregroundStyle(BloomColor.ink)
            Text("GOOD LIGHT • FULL LENGTH • YOU")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .padding(.horizontal, 13).padding(.vertical, 8)
                .background(BloomColor.paper, in: Capsule())
                .overlay(Capsule().stroke(BloomColor.ink, lineWidth: 2))
                .rotationEffect(.degrees(-3))
                .offset(y: 130)
        }
    }
}

private struct PrivacyArtwork: View {
    var body: some View {
        ZStack {
            Circle().fill(BloomColor.violet).frame(width: 235)
            Image(systemName: "lock.fill")
                .font(.system(size: 106, weight: .bold))
                .foregroundStyle(BloomColor.lime)
            ForEach(["sparkle", "heart.fill", "photo.fill"], id: \.self) { symbol in
                Image(systemName: symbol)
                    .font(.system(size: 25, weight: .bold))
                    .padding(15)
                    .background(BloomColor.paper, in: Circle())
                    .overlay(Circle().stroke(BloomColor.ink, lineWidth: 2))
                    .offset(x: symbol == "sparkle" ? -118 : symbol == "heart.fill" ? 117 : 0,
                            y: symbol == "photo.fill" ? -125 : symbol == "sparkle" ? 80 : -70)
            }
        }
    }
}
