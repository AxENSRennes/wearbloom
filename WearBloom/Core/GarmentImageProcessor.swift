import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import Vision

actor GarmentImageProcessor {
    static let shared = GarmentImageProcessor()
    private let context = CIContext(options: [.cacheIntermediates: false])

    /// Returns a transparent PNG when Vision can isolate the foreground, otherwise the original data.
    func cleanBackground(from data: Data) -> Data {
        do {
            guard let image = CIImage(data: data, options: [.applyOrientationProperty: true]) else { return data }
            let request = VNGenerateForegroundInstanceMaskRequest()
            let handler = VNImageRequestHandler(ciImage: image)
            try handler.perform([request])
            guard let observation = request.results?.first else { return data }
            let maskBuffer = try observation.generateScaledMaskForImage(
                forInstances: observation.allInstances,
                from: handler
            )
            let mask = CIImage(cvPixelBuffer: maskBuffer)
            let blend = CIFilter.blendWithMask()
            blend.inputImage = image
            blend.backgroundImage = CIImage.empty()
            blend.maskImage = mask
            guard let output = blend.outputImage,
                  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
                  let png = context.pngRepresentation(
                    of: output,
                    format: .RGBA8,
                    colorSpace: colorSpace
                  ) else { return data }
            return png
        } catch {
            return data
        }
    }
}
