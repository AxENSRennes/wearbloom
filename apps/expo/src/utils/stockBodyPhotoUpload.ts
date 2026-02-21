import { Asset } from "expo-asset";

import { STOCK_BODY_PHOTO } from "~/constants/stockGarments";
import { appendLocalImage } from "./formData";
import { compressImage } from "./imageCompressor";

type StockBodyPhotoUploadFailureReason =
  | "asset_unavailable"
  | "processing_failed"
  | "upload_failed";

type StockBodyPhotoUploadResult =
  | { success: true }
  | { success: false; reason: StockBodyPhotoUploadFailureReason };

interface StockBodyPhotoUploadOptions {
  uploadBodyPhoto: (formData: FormData) => Promise<unknown>;
}

export async function uploadStockBodyPhoto({
  uploadBodyPhoto,
}: StockBodyPhotoUploadOptions): Promise<StockBodyPhotoUploadResult> {
  let sourceUri: string;

  try {
    const asset = Asset.fromModule(STOCK_BODY_PHOTO as number);
    await asset.downloadAsync();
    sourceUri = asset.localUri ?? asset.uri;
  } catch {
    return { success: false, reason: "asset_unavailable" };
  }

  let compressed: Awaited<ReturnType<typeof compressImage>>;
  try {
    compressed = await compressImage(sourceUri);
  } catch {
    return { success: false, reason: "processing_failed" };
  }

  const formData = new FormData();
  try {
    await appendLocalImage(
      formData,
      "photo",
      compressed.uri,
      "stock-body-photo.jpg",
    );
  } catch {
    return { success: false, reason: "processing_failed" };
  }

  formData.append("width", String(compressed.width));
  formData.append("height", String(compressed.height));

  try {
    await uploadBodyPhoto(formData);
  } catch {
    return { success: false, reason: "upload_failed" };
  }

  return { success: true };
}
