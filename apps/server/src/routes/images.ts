import type http from "node:http";

import { eq } from "@acme/db";
import { bodyPhotos } from "@acme/db/schema";

interface ImageHandlerImageStorage {
  streamFile(filePath: string): ReadableStream;
}

interface ImageHandlerDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { select: (...args: any[]) => any };
  auth: {
    api: {
      getSession: (opts: {
        headers: Headers;
      }) => Promise<{
        user: { id: string };
      } | null>;
    };
  };
  imageStorage: ImageHandlerImageStorage;
}

function nodeHeadersToHeaders(
  nodeHeaders: http.IncomingHttpHeaders,
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export function createImageHandler({ db, auth, imageStorage }: ImageHandlerDeps) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Extract imageId from URL: /api/images/:imageId
    const imageId = req.url?.split("/api/images/")[1]?.split("?")[0];
    if (!imageId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing imageId" }));
      return;
    }

    // Authenticate
    const headers = nodeHeadersToHeaders(req.headers);
    const session = await auth.api.getSession({ headers });
    if (!session) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    // Look up image
    const result = await db
      .select({
        id: bodyPhotos.id,
        userId: bodyPhotos.userId,
        filePath: bodyPhotos.filePath,
        mimeType: bodyPhotos.mimeType,
      })
      .from(bodyPhotos)
      .where(eq(bodyPhotos.id, imageId))
      .limit(1);

    const photo = result[0];
    if (!photo) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Ownership check
    if (photo.userId !== session.user.id) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // Stream the file
    const stream = imageStorage.streamFile(photo.filePath as string);
    res.writeHead(200, {
      "Content-Type": (photo.mimeType as string) || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    });

    const reader = stream.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(Buffer.from(value));
      return pump();
    };
    await pump();
  };
}
