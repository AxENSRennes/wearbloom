import SwiftUI

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
