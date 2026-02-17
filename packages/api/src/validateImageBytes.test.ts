import { TRPCError } from "@trpc/server";
import { describe, expect, test } from "bun:test";

import { validateImageBytes } from "./validateImageBytes";

describe("validateImageBytes", () => {
  test("valid JPEG buffer with declaredType image/jpeg does not throw", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(() => validateImageBytes(buffer, "image/jpeg")).not.toThrow();
  });

  test("valid PNG buffer with declaredType image/png does not throw", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    expect(() => validateImageBytes(buffer, "image/png")).not.toThrow();
  });

  test("random bytes with declaredType image/jpeg throws INVALID_IMAGE_TYPE", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(() => validateImageBytes(buffer, "image/jpeg")).toThrow(TRPCError);
    try {
      validateImageBytes(buffer, "image/jpeg");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe("INVALID_IMAGE_TYPE");
    }
  });

  test("PNG magic bytes but declaredType image/jpeg throws INVALID_IMAGE_TYPE", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    expect(() => validateImageBytes(buffer, "image/jpeg")).toThrow(TRPCError);
    try {
      validateImageBytes(buffer, "image/jpeg");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe("INVALID_IMAGE_TYPE");
    }
  });

  test("JPEG magic bytes but declaredType image/png throws INVALID_IMAGE_TYPE", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(() => validateImageBytes(buffer, "image/png")).toThrow(TRPCError);
    try {
      validateImageBytes(buffer, "image/png");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe("INVALID_IMAGE_TYPE");
    }
  });

  test("empty buffer throws INVALID_IMAGE_TYPE", () => {
    const buffer = Buffer.from([]);
    expect(() => validateImageBytes(buffer, "image/jpeg")).toThrow(TRPCError);
    try {
      validateImageBytes(buffer, "image/jpeg");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe("INVALID_IMAGE_TYPE");
    }
  });

  test("tiny buffer (1 byte) throws INVALID_IMAGE_TYPE", () => {
    const buffer = Buffer.from([0xff]);
    expect(() => validateImageBytes(buffer, "image/jpeg")).toThrow(TRPCError);
    try {
      validateImageBytes(buffer, "image/jpeg");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).message).toBe("INVALID_IMAGE_TYPE");
    }
  });
});
