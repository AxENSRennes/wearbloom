import SwiftUI

enum BloomColor {
    static let ink = Color(hex: "191919")
    static let cream = Color(hex: "F6F5F1")
    static let paper = Color.white
    static let violet = Color(hex: "6547F5")
    static let lime = Color(hex: "DDF66A")
    static let coral = Color(hex: "FF7A68")
    static let muted = Color(hex: "77746E")
    static let line = Color.black.opacity(0.08)
    static let softViolet = Color(hex: "EEEAFE")
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

extension View {
    func bloomCard(radius: CGFloat = 24, offset: CGFloat = 0) -> some View {
        modifier(BloomShadow(radius: radius, offset: offset))
    }
}

struct BloomButtonStyle: ButtonStyle {
    var fill: Color = BloomColor.ink
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 14 : 16, weight: .semibold))
            .foregroundStyle(fill == BloomColor.ink || fill == BloomColor.violet ? .white : BloomColor.ink)
            .frame(maxWidth: compact ? nil : .infinity)
            .padding(.horizontal, compact ? 16 : 20)
            .frame(height: compact ? 42 : 54)
            .background(fill, in: RoundedRectangle(cornerRadius: compact ? 14 : 18, style: .continuous))
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
                .foregroundStyle(BloomColor.violet)
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
                    .foregroundStyle(BloomColor.violet)
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
