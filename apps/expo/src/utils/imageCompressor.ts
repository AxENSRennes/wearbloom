import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/**
 * Compress an image to ~1200px width, JPEG 80% quality.
 * Returns a local file:// URI with the compressed result.
 */
export async function compressImage(uri: string) {
  return manipulateAsync(uri, [{ resize: { width: 1200 } }], {
    format: SaveFormat.JPEG,
    compress: 0.8,
  });
}
