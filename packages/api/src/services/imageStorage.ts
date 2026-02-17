import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";

import type { Logger } from "pino";

interface ImageStorageOptions {
  basePath: string;
  logger?: Logger;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

export function createImageStorage({ basePath, logger }: ImageStorageOptions) {
  const resolvedBase = resolve(basePath);

  function safePath(filePath: string): string {
    const absolute = resolve(join(basePath, filePath));
    if (!absolute.startsWith(resolvedBase + "/")) {
      throw new Error("Path traversal detected");
    }
    return absolute;
  }

  return {
    async saveBodyPhoto(
      userId: string,
      fileData: Buffer,
      mimeType: string,
    ): Promise<string> {
      const ext = MIME_EXT[mimeType] ?? ".jpg";
      const timestamp = Date.now();
      const relativePath = join(
        userId,
        "body",
        `avatar_${String(timestamp)}${ext}`,
      );
      const absolutePath = safePath(relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, fileData);

      logger?.info(
        { userId, filePath: relativePath },
        "Body photo saved to disk",
      );

      return relativePath;
    },

    async deleteBodyPhoto(userId: string, filePath: string): Promise<void> {
      const absolutePath = safePath(filePath);
      try {
        await rm(absolutePath);
        logger?.info(
          { userId, filePath },
          "Body photo deleted from disk",
        );
      } catch (err) {
        logger?.error(
          { userId, filePath, err },
          "Failed to delete body photo from disk",
        );
      }
    },

    async deleteUserDirectory(userId: string): Promise<void> {
      const userDir = safePath(userId);
      await rm(userDir, { recursive: true, force: true });
      logger?.info({ userId }, "User directory deleted from disk");
    },

    getAbsolutePath(filePath: string): string {
      return safePath(filePath);
    },

    async saveGarmentPhoto(
      userId: string,
      fileData: Buffer,
      mimeType: string,
      garmentId: string,
    ): Promise<string> {
      const ext = MIME_EXT[mimeType] ?? ".jpg";
      const relativePath = join(
        userId,
        "garments",
        `${garmentId}_original${ext}`,
      );
      const absolutePath = safePath(relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, fileData);

      logger?.info(
        { userId, garmentId, filePath: relativePath },
        "Garment photo saved to disk",
      );

      return relativePath;
    },

    async saveCutoutPhoto(
      userId: string,
      fileData: Buffer,
      garmentId: string,
    ): Promise<string> {
      const relativePath = join(
        userId,
        "garments",
        `${garmentId}_cutout.png`,
      );
      const absolutePath = safePath(relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, fileData);

      logger?.info(
        { userId, garmentId, filePath: relativePath },
        "Cutout photo saved to disk",
      );

      return relativePath;
    },

    async deleteGarmentFiles(
      userId: string,
      garmentId: string,
    ): Promise<void> {
      const patterns = [`${garmentId}_original`, `${garmentId}_cutout`];

      for (const pattern of patterns) {
        // Try common extensions
        for (const ext of [".jpg", ".png"]) {
          const filePath = safePath(join(userId, "garments", `${pattern}${ext}`));
          try {
            await rm(filePath);
            logger?.info(
              { userId, garmentId, filePath },
              "Garment file deleted from disk",
            );
          } catch {
            // File may not exist, which is fine
          }
        }
      }
    },

    async saveRenderResult(
      userId: string,
      renderId: string,
      imageData: Buffer,
      mimeType: string,
    ): Promise<string> {
      const ext = MIME_EXT[mimeType] ?? ".png";
      const relativePath = join(
        userId,
        "renders",
        `${renderId}_result${ext}`,
      );
      const absolutePath = safePath(relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, imageData);

      logger?.info(
        { userId, renderId, filePath: relativePath },
        "Render result saved to disk",
      );

      return relativePath;
    },

    streamFile(filePath: string): ReadableStream {
      const absolutePath = safePath(filePath);
      const nodeStream = createReadStream(absolutePath);
      return Readable.toWeb(nodeStream) as ReadableStream;
    },
  };
}
