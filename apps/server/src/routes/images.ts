import type http from "node:http";

import { eq } from "@acme/db";
import { bodyPhotos, garments, tryOnRenders } from "@acme/db/schema";

import { nodeHeadersToHeaders } from "../utils/headers";

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

export function createImageHandler({ db, auth, imageStorage }: ImageHandlerDeps) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Handle render result images: /api/images/render/:renderId
    const renderMatch = req.url?.match(/\/api\/images\/render\/([^/?]+)/);
    if (renderMatch?.[1]) {
      const renderId = renderMatch[1];

      // Authenticate
      const headers = nodeHeadersToHeaders(req.headers);
      const session = await auth.api.getSession({ headers });
      if (!session) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const renderResult = await db
        .select({
          id: tryOnRenders.id,
          userId: tryOnRenders.userId,
          resultPath: tryOnRenders.resultPath,
          status: tryOnRenders.status,
        })
        .from(tryOnRenders)
        .where(eq(tryOnRenders.id, renderId))
        .limit(1);

      const render = renderResult[0];
      if (!render || render.status !== "completed" || !render.resultPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      if (render.userId !== session.user.id) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      const mimeType = render.resultPath ? inferMimeType(render.resultPath) : "image/png";
      return streamImage(res, imageStorage, render.resultPath, mimeType);
    }

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

    // Look up body photo first
    const bodyPhotoResult = await db
      .select({
        id: bodyPhotos.id,
        userId: bodyPhotos.userId,
        filePath: bodyPhotos.filePath,
        mimeType: bodyPhotos.mimeType,
      })
      .from(bodyPhotos)
      .where(eq(bodyPhotos.id, imageId))
      .limit(1);

    const photo = bodyPhotoResult[0];
    if (photo) {
      // Ownership check
      if (photo.userId !== session.user.id) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      // Stream the body photo
      return streamImage(res, imageStorage, photo.filePath, photo.mimeType);
    }

    // Fallback: look up garment
    const garmentResult = await db
      .select({
        id: garments.id,
        userId: garments.userId,
        imagePath: garments.imagePath,
        cutoutPath: garments.cutoutPath,
        bgRemovalStatus: garments.bgRemovalStatus,
        mimeType: garments.mimeType,
      })
      .from(garments)
      .where(eq(garments.id, imageId))
      .limit(1);

    const garment = garmentResult[0];
    if (!garment) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Ownership check
    if (garment.userId !== session.user.id) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // Serve cutout if available, otherwise original
    const useCutout = garment.bgRemovalStatus === "completed" && garment.cutoutPath;
    const filePath = useCutout ? garment.cutoutPath : garment.imagePath;
    const mimeType = useCutout ? "image/png" : garment.mimeType;

    return streamImage(res, imageStorage, filePath, mimeType);
  };
}

function inferMimeType(filePath: string): string {
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".png")) return "image/png";
  return "image/png"; // default fallback
}

function streamImage(
  res: http.ServerResponse,
  imageStorage: ImageHandlerImageStorage,
  filePath: string,
  mimeType: string | null,
) {
  const stream = imageStorage.streamFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeType ?? "image/jpeg",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });

  return (async () => {
    const reader = stream.getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      if (result.done) {
        done = true;
      } else {
        res.write(Buffer.from(result.value));
      }
    }
    res.end();
  })();
}
