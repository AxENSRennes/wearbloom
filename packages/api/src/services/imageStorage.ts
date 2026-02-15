import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
      const absolutePath = join(basePath, relativePath);

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, fileData);

      logger?.info(
        { userId, filePath: relativePath },
        "Body photo saved to disk",
      );

      return relativePath;
    },

    async deleteBodyPhoto(userId: string, filePath: string): Promise<void> {
      const absolutePath = join(basePath, filePath);
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
      const userDir = join(basePath, userId);
      await rm(userDir, { recursive: true, force: true });
      logger?.info({ userId }, "User directory deleted from disk");
    },

    getAbsolutePath(filePath: string): string {
      return join(basePath, filePath);
    },

    streamFile(filePath: string): ReadableStream {
      const absolutePath = join(basePath, filePath);
      const nodeStream = createReadStream(absolutePath);
      return Readable.toWeb(nodeStream) as ReadableStream;
    },
  };
}
