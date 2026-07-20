import SwiftUI

enum BloomColor {
    static let ink = Color(hex: "171717")
    static let cream = Color(hex: "F6F0E7")
    static let paper = Color(hex: "FFFDF8")
    static let violet = Color(hex: "5B3DF5")
    static let lime = Color(hex: "D8FF3E")
    static let coral = Color(hex: "FF6A55")
    static let muted = Color(hex: "756F67")
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
    var radius: CGFloat = 22
    var offset: CGFloat = 5

    func body(content: Content) -> some View {
        content
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(BloomColor.ink, lineWidth: 2)
            }
            .background {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(BloomColor.ink)
                    .offset(x: offset, y: offset)
            }
    }
}

extension View {
    func bloomCard(radius: CGFloat = 22, offset: CGFloat = 5) -> some View {
        modifier(BloomShadow(radius: radius, offset: offset))
    }
}

struct BloomButtonStyle: ButtonStyle {
    var fill: Color = BloomColor.lime
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 14 : 16, weight: .bold, design: .rounded))
            .foregroundStyle(BloomColor.ink)
            .frame(maxWidth: compact ? nil : .infinity)
            .padding(.horizontal, compact ? 16 : 20)
            .frame(height: compact ? 40 : 54)
            .background(fill, in: RoundedRectangle(cornerRadius: compact ? 13 : 17, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: compact ? 13 : 17, style: .continuous)
                    .stroke(BloomColor.ink, lineWidth: 2)
            }
            .background {
                RoundedRectangle(cornerRadius: compact ? 13 : 17, style: .continuous)
                    .fill(BloomColor.ink)
                    .offset(x: 4, y: 4)
            }
            .offset(y: configuration.isPressed ? 3 : 0)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

struct BloomOutlineButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold, design: .rounded))
            .foregroundStyle(BloomColor.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(BloomColor.paper, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .stroke(BloomColor.ink, lineWidth: 2)
            }
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct SectionEyebrow: View {
    let text: LocalizedStringKey

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .textCase(.uppercase)
            .tracking(1.2)
            .foregroundStyle(BloomColor.muted)
    }
}

struct BloomWordmark: View {
    var body: some View {
        HStack(spacing: 7) {
            ZStack {
                Circle().fill(BloomColor.violet)
                Image(systemName: "sparkle")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(BloomColor.lime)
            }
            .frame(width: 27, height: 27)
            Text("WearBloom")
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .tracking(-0.5)
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
                BloomColor.cream
                Image(systemName: fallback)
                    .font(.system(size: 28, weight: .medium))
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
