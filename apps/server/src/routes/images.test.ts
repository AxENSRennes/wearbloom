import type http from "node:http";
import { afterEach, describe, expect, mock, test } from "bun:test";

import { bodyPhotos, garments } from "@acme/db/schema";

import { createImageHandler } from "./images";

// Mock dependencies using DI
const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: {
    id: "sess-123",
    token: "tok",
    expiresAt: new Date(),
    userId: "user-123",
  },
};

function createMockAuth(session: typeof mockSession | null = mockSession) {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
    },
  };
}

interface MockDbOptions {
  bodyPhoto?: {
    id: string;
    userId: string;
    filePath: string;
    mimeType: string;
  } | null;
  garment?: {
    id: string;
    userId: string;
    imagePath: string;
    cutoutPath: string | null;
    bgRemovalStatus: string;
    mimeType: string;
  } | null;
}

function createMockDb(options: MockDbOptions = {}) {
  const { bodyPhoto = null, garment = null } = options;

  // Track which table is being queried via the from() call
  let currentTable: unknown = null;

  const chain = {
    select: mock(() => {
      currentTable = null;
      return chain;
    }),
    from: mock((table: unknown) => {
      currentTable = table;
      return chain;
    }),
    where: mock(() => chain),
    limit: mock(() => {
      if (currentTable === bodyPhotos) {
        return Promise.resolve(bodyPhoto ? [bodyPhoto] : []);
      }
      if (currentTable === garments) {
        return Promise.resolve(garment ? [garment] : []);
      }
      return Promise.resolve([]);
    }),
  };
  return chain;
}

function createMockImageStorage() {
  return {
    streamFile: mock(
      () =>
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
  afterEach(() => {
    mock.restore();
  });

  test("returns 401 when not authenticated", async () => {
    const auth = createMockAuth(null);
    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/a1b2c3d4e5f6g7h8i9j0kl1",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(401, {
      "Content-Type": "application/json",
    });
  });

  test("returns 400 when imageId is missing", async () => {
    const auth = createMockAuth(mockSession);
    const db = createMockDb();
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = { url: "/api/images/", headers: {} } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(400, {
      "Content-Type": "application/json",
    });
  });

  test("returns 404 when neither body photo nor garment found", async () => {
    const auth = createMockAuth(mockSession);
    const db = createMockDb({ bodyPhoto: null, garment: null });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/b2c3d4e5f6g7h8i9j0kl1m2",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, {
      "Content-Type": "application/json",
    });
  });

  test("returns 403 when user does not own the body photo", async () => {
    const auth = createMockAuth(mockSession);
    const photo = {
      id: "c3d4e5f6g7h8i9j0kl1m2n3",
      userId: "other-user",
      filePath: "other/body/avatar.jpg",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: photo });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/c3d4e5f6g7h8i9j0kl1m2n3",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(403, {
      "Content-Type": "application/json",
    });
  });

  test("returns 200 and streams body photo when authorized", async () => {
    const auth = createMockAuth(mockSession);
    const photo = {
      id: "d4e5f6g7h8i9j0kl1m2n3o4",
      userId: "user-123",
      filePath: "user-123/body/avatar.jpg",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: photo });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/d4e5f6g7h8i9j0kl1m2n3o4",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    expect(imageStorage.streamFile).toHaveBeenCalledWith(
      "user-123/body/avatar.jpg",
    );
  });

  // --- Garment image tests ---

  test("serves garment original image when body photo not found", async () => {
    const auth = createMockAuth(mockSession);
    const garment = {
      id: "e5f6g7h8i9j0kl1m2n3o4p5",
      userId: "user-123",
      imagePath: "user-123/garments/e5f6g7h8i9j0kl1m2n3o4p5/original.jpg",
      cutoutPath: null,
      bgRemovalStatus: "pending",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: null, garment });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/e5f6g7h8i9j0kl1m2n3o4p5",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    expect(imageStorage.streamFile).toHaveBeenCalledWith(
      "user-123/garments/e5f6g7h8i9j0kl1m2n3o4p5/original.jpg",
    );
  });

  test("serves garment cutout image when bgRemovalStatus is completed", async () => {
    const auth = createMockAuth(mockSession);
    const garment = {
      id: "f6g7h8i9j0kl1m2n3o4p5q6",
      userId: "user-123",
      imagePath: "user-123/garments/f6g7h8i9j0kl1m2n3o4p5q6/original.jpg",
      cutoutPath: "user-123/garments/f6g7h8i9j0kl1m2n3o4p5q6/cutout.png",
      bgRemovalStatus: "completed",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: null, garment });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/f6g7h8i9j0kl1m2n3o4p5q6",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    expect(imageStorage.streamFile).toHaveBeenCalledWith(
      "user-123/garments/f6g7h8i9j0kl1m2n3o4p5q6/cutout.png",
    );
  });

  test("returns 403 when user does not own the garment", async () => {
    const auth = createMockAuth(mockSession);
    const garment = {
      id: "g7h8i9j0kl1m2n3o4p5q6r7",
      userId: "other-user",
      imagePath: "other-user/garments/g7h8i9j0kl1m2n3o4p5q6r7/original.jpg",
      cutoutPath: null,
      bgRemovalStatus: "pending",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: null, garment });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/g7h8i9j0kl1m2n3o4p5q6r7",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(403, {
      "Content-Type": "application/json",
    });
  });

  test("falls back to original image when cutoutPath is null even with completed status", async () => {
    const auth = createMockAuth(mockSession);
    const garment = {
      id: "h8i9j0kl1m2n3o4p5q6r7s8",
      userId: "user-123",
      imagePath: "user-123/garments/h8i9j0kl1m2n3o4p5q6r7s8/original.jpg",
      cutoutPath: null,
      bgRemovalStatus: "completed",
      mimeType: "image/jpeg",
    };
    const db = createMockDb({ bodyPhoto: null, garment });
    const imageStorage = createMockImageStorage();
    const handler = createImageHandler({
      db: db as never,
      auth: auth as never,
      imageStorage,
    });

    const req = {
      url: "/api/images/h8i9j0kl1m2n3o4p5q6r7s8",
      headers: {},
    } as http.IncomingMessage;
    const res = createMockRes();

    await handler(req, res);

    expect(imageStorage.streamFile).toHaveBeenCalledWith(
      "user-123/garments/h8i9j0kl1m2n3o4p5q6r7s8/original.jpg",
    );
  });
});
