import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AuthInstance, BackgroundRemoval } from "../trpc";
import { createTRPCContext } from "../trpc";

const mockSession = {
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  session: {
    id: "sess-123",
    token: "tok-abc",
    expiresAt: new Date("2030-01-01"),
    userId: "user-123",
  },
};

function createMockAuth(
  session: typeof mockSession | null = mockSession,
): AuthInstance {
  return {
    api: {
      getSession: mock(() => Promise.resolve(session)),
      signOut: mock(() => Promise.resolve()),
    },
  };
}

function createMockImageStorage() {
  return {
    saveBodyPhoto: mock(() => Promise.resolve("user-123/body/avatar_123.jpg")),
    deleteBodyPhoto: mock(() => Promise.resolve()),
    deleteUserDirectory: mock(() => Promise.resolve()),
    getAbsolutePath: mock((p: string) => `/data/images/${p}`),
    streamFile: mock(() => new ReadableStream()),
    saveGarmentPhoto: mock(() =>
      Promise.resolve("user-123/garments/garment-abc_original.jpg"),
    ),
    saveCutoutPhoto: mock(() =>
      Promise.resolve("user-123/garments/garment-abc_cutout.png"),
    ),
    deleteGarmentFiles: mock(() => Promise.resolve()),
  };
}

function createMockBackgroundRemoval(): BackgroundRemoval {
  return {
    removeBackground: mock(() =>
      Promise.resolve(Buffer.from("mock-cutout")),
    ),
  };
}

function mockDbInsert(returnId = "garment-abc") {
  const chain: Record<string, unknown> = {};
  chain.values = mock(() => chain);
  chain.returning = mock(() => chain);
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown[]) => void;
    return resolve([{ id: returnId }]);
  });
  return chain;
}

function mockDbUpdate() {
  const chain: Record<string, unknown> = {};
  chain.set = mock(() => chain);
  chain.where = mock(() => chain);
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown) => void;
    return resolve(undefined);
  });
  return chain;
}

function mockDbSelect(results: unknown[] = []) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "from", "where", "limit", "orderBy"];
  for (const method of methods) {
    chain[method] = mock(() => chain);
  }
  chain.then = mock((...args: unknown[]) => {
    const resolve = args[0] as (val: unknown[]) => void;
    return resolve(results);
  });
  return chain;
}

async function createAuthenticatedCaller(
  imageStorage = createMockImageStorage(),
  backgroundRemoval: BackgroundRemoval | undefined = createMockBackgroundRemoval(),
  session: typeof mockSession | null = mockSession,
) {
  const { appRouter } = await import("../root");
  const auth = createMockAuth(session);
  const ctx = await createTRPCContext({
    headers: new Headers({ cookie: "session=xyz" }),
    auth,
    imageStorage,
    backgroundRemoval,
  });
  return { caller: appRouter.createCaller(ctx), imageStorage, backgroundRemoval };
}

describe("garment.upload", () => {
  let insertSpy: ReturnType<typeof spyOn>;
  let updateSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    insertSpy?.mockRestore();
    updateSpy?.mockRestore();
  });

  test("creates garment record and returns garmentId", async () => {
    const { db } = await import("@acme/db/client");
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("garment-new") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["image-data"], "garment.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "tops");
    formData.append("width", "1200");
    formData.append("height", "800");

    const result = await caller.garment.upload(formData);

    expect(result.garmentId).toBe("garment-new");
    expect(result.imageId).toBe("garment-new");
    expect(imageStorage.saveGarmentPhoto).toHaveBeenCalled();
  });

  test("rejects invalid category", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "garment.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "hats");

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /INVALID_CATEGORY/,
    );
  });

  test("rejects invalid file type", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "garment.pdf", { type: "application/pdf" }),
    );
    formData.append("category", "tops");

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /INVALID_IMAGE_TYPE/,
    );
  });

  test("rejects oversized file", async () => {
    const { caller } = await createAuthenticatedCaller();

    const bigData = new Uint8Array(11 * 1024 * 1024);
    const formData = new FormData();
    formData.append(
      "photo",
      new File([bigData], "big.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "tops");

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /IMAGE_TOO_LARGE/,
    );
  });

  test("rejects missing photo", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append("category", "tops");

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /MISSING_PHOTO/,
    );
  });

  test("rejects missing category", async () => {
    const { caller } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "garment.jpg", { type: "image/jpeg" }),
    );

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /MISSING_CATEGORY/,
    );
  });

  test("rejects unauthenticated requests", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(null);
    const ctx = await createTRPCContext({
      headers: new Headers(),
      auth,
      imageStorage: createMockImageStorage(),
    });
    const caller = appRouter.createCaller(ctx);

    const formData = new FormData();
    formData.append(
      "photo",
      new File(["data"], "garment.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "tops");

    await expect(caller.garment.upload(formData)).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });
});

describe("garment.list", () => {
  let selectSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    selectSpy?.mockRestore();
  });

  test("returns garments for the authenticated user", async () => {
    const { db } = await import("@acme/db/client");
    const mockResults = [
      { id: "g1", userId: "user-123", category: "tops", imagePath: "path1" },
      { id: "g2", userId: "user-123", category: "bottoms", imagePath: "path2" },
    ];
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect(mockResults) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list();

    expect(result).toHaveLength(2);
  });

  test("returns garments filtered by category", async () => {
    const { db } = await import("@acme/db/client");
    const mockResults = [
      { id: "g1", userId: "user-123", category: "tops", imagePath: "path1" },
    ];
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect(mockResults) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list({ category: "tops" });

    expect(result).toHaveLength(1);
  });

  test("returns all garments when no filter provided", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list();

    expect(result).toHaveLength(0);
  });
});

describe("garment.getGarment", () => {
  let selectSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    selectSpy?.mockRestore();
  });

  test("returns garment by id for authenticated owner", async () => {
    const { db } = await import("@acme/db/client");
    const garment = {
      id: "g1",
      userId: "user-123",
      category: "tops",
      imagePath: "path1",
      bgRemovalStatus: "completed",
    };
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([garment]) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.getGarment({ garmentId: "g1" });

    expect(result.id).toBe("g1");
    expect(result.bgRemovalStatus).toBe("completed");
  });

  test("throws NOT_FOUND for non-existent garment", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.garment.getGarment({ garmentId: "nonexistent" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
  });

  test("throws FORBIDDEN for non-owner", async () => {
    const { db } = await import("@acme/db/client");
    const garment = {
      id: "g1",
      userId: "other-user",
      category: "tops",
      imagePath: "path1",
    };
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([garment]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.garment.getGarment({ garmentId: "g1" }),
    ).rejects.toThrow(/NOT_GARMENT_OWNER/);
  });
});
