import { TRPCError } from "@trpc/server";

export function validateImageBytes(buffer: Buffer, declaredType: string): void {
  const jpegMagic =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const pngMagic =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  const detectedType = jpegMagic ? "image/jpeg" : pngMagic ? "image/png" : null;

  if (!detectedType || detectedType !== declaredType) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "INVALID_IMAGE_TYPE" });
  }
}
