import SwiftUI

struct EditGarmentView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var garment: Garment

    var body: some View {
        NavigationStack {
            Form {
                ImageDataView(data: garment.imageData, contentMode: .fit, fallback: garment.category.symbol)
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                TextField("Name", text: $garment.name)
                Picker("Category", selection: $garment.categoryRawValue) {
                    ForEach(GarmentCategory.allCases) { Text($0.title).tag($0.rawValue) }
                }
                Toggle("Favorite", isOn: $garment.isFavorite)
            }
            .navigationTitle("Edit piece")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
