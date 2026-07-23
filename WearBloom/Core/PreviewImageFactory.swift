import SwiftUI
import UIKit

@MainActor
enum PreviewImageFactory {
    static func bundledData(named name: String) -> Data? {
        let parts = name.split(separator: ".", maxSplits: 1).map(String.init)
        guard parts.count == 2,
              let url = Bundle.main.url(forResource: parts[0], withExtension: parts[1]) else { return nil }
        return try? Data(contentsOf: url)
    }

    static func garmentPoster(color: UIColor, symbol: String) -> Data? {
        let size = CGSize(width: 700, height: 840)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.88) { context in
            UIColor(red: 0.97, green: 0.94, blue: 0.90, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            color.withAlphaComponent(0.22).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 65, y: 60, width: 570, height: 570))
            let image = UIImage(systemName: symbol)?.withTintColor(color, renderingMode: .alwaysOriginal)
            image?.draw(in: CGRect(x: 145, y: 150, width: 410, height: 500))
        }
    }

    static func referencePoster() -> Data? {
        let size = CGSize(width: 820, height: 1120)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.9) { context in
            UIColor(Color(hex: "FF6A55")).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            UIColor(Color(hex: "5B3DF5")).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: -140, y: 80, width: 680, height: 680))
            UIColor(Color(hex: "D8FF3E")).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 415, y: 535, width: 530, height: 530))
            UIColor(red: 0.76, green: 0.53, blue: 0.40, alpha: 1).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 320, y: 150, width: 180, height: 220))
            UIColor(Color(hex: "171717")).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 295, y: 105, width: 230, height: 165))
            let body = UIBezierPath(roundedRect: CGRect(x: 205, y: 330, width: 410, height: 630), cornerRadius: 170)
            UIColor(Color(hex: "F6F0E7")).setFill()
            body.fill()
            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = .center
            ("YOUR PHOTO" as NSString).draw(
                in: CGRect(x: 180, y: 995, width: 460, height: 60),
                withAttributes: [
                    .font: UIFont.monospacedSystemFont(ofSize: 28, weight: .bold),
                    .foregroundColor: UIColor(Color(hex: "171717")),
                    .paragraphStyle: paragraph
                ]
            )
        }
    }

    static func compose(referenceData: Data?, garments: [Garment]) -> Data? {
        guard let referenceData, let reference = UIImage(data: referenceData) else { return referenceData }
        let size = CGSize(width: 1024, height: 1365)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.92) { context in
            reference.draw(in: CGRect(origin: .zero, size: size))
            UIColor(Color(hex: "3038F2")).withAlphaComponent(0.20).setFill()
            context.fill(CGRect(origin: .zero, size: size))
            let panel = CGRect(x: 90, y: 900, width: 844, height: 340)
            let panelPath = UIBezierPath(roundedRect: panel, cornerRadius: 52)
            UIColor(Color(hex: "F6F0E7")).withAlphaComponent(0.94).setFill()
            panelPath.fill()
            UIColor(Color(hex: "171717")).setStroke()
            panelPath.lineWidth = 7
            panelPath.stroke()
            let tileWidth: CGFloat = 190
            let gap: CGFloat = 22
            let total = CGFloat(garments.count) * tileWidth + CGFloat(max(0, garments.count - 1)) * gap
            var x = panel.midX - total / 2
            for garment in garments {
                if let data = garment.imageData, let image = UIImage(data: data) {
                    let rect = CGRect(x: x, y: panel.minY + 52, width: tileWidth, height: 235)
                    UIBezierPath(roundedRect: rect, cornerRadius: 35).addClip()
                    image.draw(in: rect)
                    context.cgContext.resetClip()
                }
                x += tileWidth + gap
            }
        }
    }
}
