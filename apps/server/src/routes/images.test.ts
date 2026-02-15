import type http from "node:http";
import { describe, expect, mock, test } from "bun:test";

import { createImageHandler } from "./images";

// Mock dependencies using DI
const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: { id: "sess-123", token: "tok", expiresAt: new Date(), userId: "user-123" },
};

function createMockAuth(session: typeof mockSession | null = mockSession) {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
    },
  };
}

function createMockDb(photo: { id: string; userId: string; filePath: string; mimeType: string } | null = null) {
  const chain = {
    select: mock(() => chain),
    from: mock(() => chain),
    where: mock(() => chain),
    limit: mock(() => Promise.resolve(photo ? [photo] : [])),
  };
  return chain;
}

function createMockImageStorage() {
  return {
    streamFile: mock(() =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("image-bytes"));
          controller.close();
        },
      }),
    ),
    getAbsolutePath: mock((p: string) => `/data/${p}`),
    saveBodyPhoto: mock(() => Promise.resolve("")),
    deleteBodyPhoto: mock(() => Promise.resolve()),
  };
}

function createMockRes() {
  const res = {
    writeHead: mock(() => res),
    end: mock(() => res),
    statusCode: 200,
    _chunks: [] as Buffer[],
  } as unknown as http.ServerResponse & { _chunks: Buffer[] };

  // Mock write to capture output
  (res as unknown as Record<string, unknown>).write = mock((chunk: Buffer) => {
    (res as unknown as { _chunks: Buffer[] })._chunks.push(chunk);
    return true;
  });

  return res;
}

describe("createImageHandler", () => {
  test("returns 401 when not authenticated", async () => {
    const auth = createMockAuth(null);
    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({ db: db as never, auth: auth as never, imageStorage });

    const req = { url: "/api/images/img-123", headers: {} } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
  });

  test("returns 404 when image not found", async () => {
    const auth = createMockAuth(mockSession);
    const db = createMockDb(null);
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({ db: db as never, auth: auth as never, imageStorage });

    const req = { url: "/api/images/img-999", headers: {} } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
  });

  test("returns 403 when user does not own the image", async () => {
    const auth = createMockAuth(mockSession);
    const photo = { id: "img-other", userId: "other-user", filePath: "other/body/avatar.jpg", mimeType: "image/jpeg" };
    const db = createMockDb(photo);
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({ db: db as never, auth: auth as never, imageStorage });

    const req = { url: "/api/images/img-other", headers: {} } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(403, { "Content-Type": "application/json" });
  });

  test("returns 200 and streams file when authorized", async () => {
    const auth = createMockAuth(mockSession);
    const photo = { id: "img-owned", userId: "user-123", filePath: "user-123/body/avatar.jpg", mimeType: "image/jpeg" };
    const db = createMockDb(photo);
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({ db: db as never, auth: auth as never, imageStorage });

    const req = { url: "/api/images/img-owned", headers: {} } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    });
    expect(imageStorage.streamFile).toHaveBeenCalledWith("user-123/body/avatar.jpg");
  });
});
