export type ImageMetadata = {
  contentType: "image/jpeg" | "image/png" | "image/heic";
  width?: number;
  height?: number;
  extension: string;
};

export function inspectImage(bytes: Uint8Array): ImageMetadata {
  if (bytes.length < 16) throw new Error("UPLOAD_INVALID_IMAGE");
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { contentType: "image/png", width: view.getUint32(16), height: view.getUint32(20), extension: "png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const dimensions = jpegDimensions(bytes);
    return { contentType: "image/jpeg", ...dimensions, extension: "jpg" };
  }
  const marker = new TextDecoder().decode(bytes.slice(4, 12));
  if (marker.includes("ftyp") && ["heic", "heix", "hevc", "mif1"].some((brand) => marker.includes(brand))) {
    return { contentType: "image/heic", extension: "heic" };
  }
  throw new Error("UPLOAD_UNSUPPORTED_TYPE");
}

function jpegDimensions(bytes: Uint8Array): { width?: number; height?: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === undefined) break;
    const length = view.getUint16(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return {};
}
