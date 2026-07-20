import PhotosUI
import SwiftUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let onImage: (Data) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage,
               let data = image.normalizedJPEGData(maxDimension: 2048) {
                parent.onImage(data)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

extension UIImage {
    func normalizedJPEGData(maxDimension: CGFloat) -> Data? {
        let scale = min(1, maxDimension / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: target)
        let result = renderer.image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return result.jpegData(compressionQuality: 0.88)
    }
}

struct PhotoGuideView: View {
    var body: some View {
        HStack(alignment: .top, spacing: 13) {
            Image(systemName: "sun.max.fill")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(BloomColor.violet)
            VStack(alignment: .leading, spacing: 3) {
                Text("A stronger photo makes a stronger preview")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                Text("Stand naturally, show your full body, and use even light. Avoid mirrors and group photos.")
                    .font(.system(size: 12, weight: .regular, design: .rounded))
                    .foregroundStyle(BloomColor.muted)
            }
        }
        .padding(14)
        .background(BloomColor.lime.opacity(0.42), in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
}
