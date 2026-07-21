import UIKit

enum ShareImageRenderer {
    static func makeVerticalStory(resultData: Data, lookName: String) -> UIImage? {
        guard let source = UIImage(data: resultData) else { return nil }
        let size = CGSize(width: 1080, height: 1920)
        let imageFrame = CGRect(x: 0, y: 0, width: size.width, height: 1640)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { context in
            UIColor(red: 0.965, green: 0.941, blue: 0.906, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))

            let sourceRatio = source.size.width / max(source.size.height, 1)
            let frameRatio = imageFrame.width / imageFrame.height
            let drawSize: CGSize
            if sourceRatio > frameRatio {
                drawSize = CGSize(width: imageFrame.height * sourceRatio, height: imageFrame.height)
            } else {
                drawSize = CGSize(width: imageFrame.width, height: imageFrame.width / sourceRatio)
            }
            let drawRect = CGRect(
                x: imageFrame.midX - drawSize.width / 2,
                y: imageFrame.midY - drawSize.height / 2,
                width: drawSize.width,
                height: drawSize.height
            )
            context.cgContext.saveGState()
            context.cgContext.clip(to: imageFrame)
            source.draw(in: drawRect)
            context.cgContext.restoreGState()

            UIColor(red: 0.188, green: 0.220, blue: 0.949, alpha: 1).setFill()
            context.fill(CGRect(x: 0, y: 1640, width: size.width, height: 18))

            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = .left
            paragraph.lineBreakMode = .byTruncatingTail
            (lookName as NSString).draw(
                in: CGRect(x: 72, y: 1702, width: 700, height: 62),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 42, weight: .bold),
                    .foregroundColor: UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1),
                    .paragraphStyle: paragraph,
                ]
            )
            ("COMPOSED WITH WEARBLOOM" as NSString).draw(
                in: CGRect(x: 72, y: 1790, width: 720, height: 44),
                withAttributes: [
                    .font: UIFont.monospacedSystemFont(ofSize: 25, weight: .semibold),
                    .foregroundColor: UIColor(red: 0.33, green: 0.33, blue: 0.33, alpha: 1),
                    .paragraphStyle: paragraph,
                ]
            )

            UIColor(red: 0.85, green: 1, blue: 0.26, alpha: 1).setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 892, y: 1718, width: 116, height: 116))
            let mark = NSMutableParagraphStyle()
            mark.alignment = .center
            ("WB" as NSString).draw(
                in: CGRect(x: 892, y: 1754, width: 116, height: 48),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 31, weight: .black),
                    .foregroundColor: UIColor.black,
                    .paragraphStyle: mark,
                ]
            )
        }
    }
}
