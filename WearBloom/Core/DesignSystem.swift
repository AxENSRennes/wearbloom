import SwiftUI

enum BloomColor {
    static let ink = Color(hex: "171717")
    static let cream = Color(hex: "F7F1E8")
    static let paper = Color.white
    static let blue = Color(hex: "3038F2")
    /// Compatibility alias while older feature code is progressively migrated.
    static let violet = blue
    static let lime = Color(hex: "D9FF43")
    static let coral = Color(hex: "FF6D5B")
    static let muted = Color(hex: "6F6A62")
    static let line = Color.black.opacity(0.12)
    static let softBlue = Color(hex: "E9EBFF")
    static let softViolet = softBlue
}

extension Color {
    init(hex: String) {
        let cleaned = hex.replacingOccurrences(of: "#", with: "")
        let value = UInt64(cleaned, radix: 16) ?? 0
        let red = Double((value >> 16) & 0xff) / 255
        let green = Double((value >> 8) & 0xff) / 255
        let blue = Double(value & 0xff) / 255
        self.init(red: red, green: green, blue: blue)
    }
}

struct BloomShadow: ViewModifier {
    var radius: CGFloat = 24
    var offset: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(BloomColor.line, lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.06), radius: 16, y: 6)
    }
}

struct BloomPageBackground: View {
    var body: some View {
        ZStack {
            BloomColor.cream
            OrganicBlob()
                .fill(BloomColor.blue)
                .frame(width: 220, height: 190)
                .rotationEffect(.degrees(18))
                .offset(x: 165, y: -350)
            Circle()
                .fill(BloomColor.lime)
                .frame(width: 150)
                .offset(x: -210, y: 350)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

extension View {
    func bloomCard(radius: CGFloat = 24, offset: CGFloat = 0) -> some View {
        modifier(BloomShadow(radius: radius, offset: offset))
    }
}

struct BloomButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    var fill: Color = BloomColor.ink
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 14 : 16, weight: .semibold))
            .foregroundStyle(isEnabled ? (fill == BloomColor.ink || fill == BloomColor.blue ? .white : BloomColor.ink) : BloomColor.muted)
            .frame(maxWidth: compact ? nil : .infinity)
            .padding(.horizontal, compact ? 16 : 20)
            .frame(height: compact ? 42 : 54)
            .background {
                ZStack {
                    if isEnabled && fill == BloomColor.lime {
                        Capsule().fill(BloomColor.coral).offset(y: 4)
                    }
                    Capsule().fill(isEnabled ? fill : Color(hex: "E5E1D9"))
                }
            }
            .overlay(Capsule().stroke(isEnabled ? BloomColor.ink : BloomColor.line, lineWidth: fill == BloomColor.lime ? 2 : 0))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(configuration.isPressed ? 0.86 : 1)
            .animation(.snappy(duration: 0.16), value: configuration.isPressed)
    }
}

struct BloomOutlineButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(BloomColor.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .stroke(BloomColor.line, lineWidth: 1)
            }
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct SectionEyebrow: View {
    let text: LocalizedStringKey

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(BloomColor.muted)
    }
}

struct BloomWordmark: View {
    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: "sparkle")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(BloomColor.blue)
                .frame(width: 24, height: 24)
                .background(BloomColor.lime, in: Circle())
            Text("WearBloom")
                .font(.system(size: 17, weight: .semibold))
        }
        .foregroundStyle(BloomColor.ink)
    }
}

struct ImageDataView: View {
    let data: Data?
    var contentMode: ContentMode = .fill
    var fallback: String = "photo"

    var body: some View {
        if let data, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: contentMode)
        } else {
            ZStack {
                BloomColor.softViolet
                Image(systemName: fallback)
                    .font(.system(size: 27, weight: .regular))
                    .foregroundStyle(BloomColor.blue)
            }
        }
    }
}

struct BloomHeader: View {
    let title: String
    var subtitle: String?
    var actionSystemImage: String = "person.crop.circle"
    var action: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 33, weight: .black, design: .rounded))
                    .tracking(-1.1)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(BloomColor.muted)
                }
            }
            Spacer()
            Button(action: action) {
                Image(systemName: actionSystemImage)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(BloomColor.ink)
                    .frame(width: 44, height: 44)
                    .background(BloomColor.paper, in: Circle())
                    .overlay(Circle().stroke(BloomColor.ink, lineWidth: 1.5))
            }
            .accessibilityLabel("Profile and settings")
        }
    }
}

struct BloomPill: View {
    let title: String
    var systemImage: String?
    var selected = false

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage { Image(systemName: systemImage) }
            Text(title)
        }
        .font(.system(size: 13, weight: .bold))
        .foregroundStyle(selected ? .white : BloomColor.ink)
        .padding(.horizontal, 14)
        .frame(height: 38)
        .background(selected ? BloomColor.blue : BloomColor.paper, in: Capsule())
        .overlay(Capsule().stroke(BloomColor.ink, lineWidth: selected ? 0 : 1.4))
    }
}

struct BloomSectionTitle: View {
    let title: String
    var detail: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 20, weight: .bold))
            Spacer()
            if let detail {
                Text(detail)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(BloomColor.blue)
            }
        }
    }
}

struct OrganicBlob: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX + rect.width * 0.10, y: rect.minY + rect.height * 0.26))
        path.addCurve(
            to: CGPoint(x: rect.minX + rect.width * 0.88, y: rect.minY + rect.height * 0.12),
            control1: CGPoint(x: rect.minX + rect.width * 0.26, y: rect.minY - rect.height * 0.10),
            control2: CGPoint(x: rect.minX + rect.width * 0.72, y: rect.minY + rect.height * 0.02)
        )
        path.addCurve(
            to: CGPoint(x: rect.minX + rect.width * 0.76, y: rect.minY + rect.height * 0.92),
            control1: CGPoint(x: rect.maxX + rect.width * 0.08, y: rect.minY + rect.height * 0.40),
            control2: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.78)
        )
        path.addCurve(
            to: CGPoint(x: rect.minX + rect.width * 0.10, y: rect.minY + rect.height * 0.26),
            control1: CGPoint(x: rect.minX + rect.width * 0.44, y: rect.maxY + rect.height * 0.10),
            control2: CGPoint(x: rect.minX - rect.width * 0.08, y: rect.minY + rect.height * 0.75)
        )
        return path
    }
}
