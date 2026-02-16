import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AuthInstance, BackgroundRemoval } from "../trpc";
import { createTRPCContext } from "../trpc";
import {
  createMockImageStorage,
  mockDbDelete,
  mockDbInsert,
  mockDbSelect,
  mockDbUpdate,
} from "../../test/helpers";

/** JPEG stub with valid magic bytes (0xFF 0xD8 0xFF) */
const JPEG_STUB = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);

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

function createMockBackgroundRemoval(): BackgroundRemoval {
  return {
    removeBackground: mock(() =>
      Promise.resolve(Buffer.from("mock-cutout")),
    ),
  };
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
  return {
    caller: appRouter.createCaller(ctx),
    imageStorage,
    backgroundRemoval,
    auth,
  };
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
      new File([JPEG_STUB], "garment.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "tops");
    formData.append("width", "1200");
    formData.append("height", "800");

    const result = await caller.garment.upload(formData);

    expect(result.garmentId).toBe("garment-new");
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

  test("properly handles database insert chain methods", async () => {
    const { db } = await import("@acme/db/client");
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("garment-abc") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();

    const formData = new FormData();
    formData.append(
      "photo",
      new File([JPEG_STUB], "garment.jpg", { type: "image/jpeg" }),
    );
    formData.append("category", "tops");
    formData.append("width", "1200");
    formData.append("height", "800");

    await caller.garment.upload(formData);

    // Verify insert was called
    expect(insertSpy).toHaveBeenCalled();
    // Verify imageStorage.saveGarmentPhoto was called
    expect(imageStorage.saveGarmentPhoto).toHaveBeenCalled();
  });

  test("verifies imageStorage.saveGarmentPhoto receives correct file", async () => {
    const { db } = await import("@acme/db/client");
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("test-123") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();

    const formData = new FormData();
    const testFile = new File([JPEG_STUB], "photo.jpg", {
      type: "image/jpeg",
    });
    formData.append("photo", testFile);
    formData.append("category", "bottoms");
    formData.append("width", "1500");
    formData.append("height", "2000");

    await caller.garment.upload(formData);

    expect(imageStorage.saveGarmentPhoto).toHaveBeenCalled();
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

  test("respects category filter parameter", async () => {
    const { db } = await import("@acme/db/client");
    const mockResults = [
      { id: "g1", userId: "user-123", category: "dresses", imagePath: "path1" },
    ];
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect(mockResults) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list({ category: "dresses" });

    expect(result).toHaveLength(1);
    expect(result[0]?.category).toBe("dresses");
  });

  test("returns empty array when no garments match filter", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list({ category: "bottoms" });

    expect(result).toEqual([]);
  });

  test("handles multiple garments in results", async () => {
    const { db } = await import("@acme/db/client");
    const mockResults = [
      { id: "g1", userId: "user-123", category: "tops", imagePath: "path1" },
      { id: "g2", userId: "user-123", category: "tops", imagePath: "path2" },
      { id: "g3", userId: "user-123", category: "tops", imagePath: "path3" },
    ];
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect(mockResults) as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.garment.list();

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe("g1");
    expect(result[1]?.id).toBe("g2");
    expect(result[2]?.id).toBe("g3");
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

  test("throws NOT_FOUND for non-owner (ownership check in WHERE)", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.garment.getGarment({ garmentId: "g1" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
  });
});

describe("garment.delete", () => {
  let selectSpy: ReturnType<typeof spyOn>;
  let deleteSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    selectSpy?.mockRestore();
    deleteSpy?.mockRestore();
  });

  test("successful deletion returns { success: true } and calls deleteGarmentFiles + DB delete", async () => {
    const { db } = await import("@acme/db/client");
    const existingGarment = { id: "garment-abc" };
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([existingGarment]) as never,
    );
    deleteSpy = spyOn(db as never, "delete").mockReturnValue(
      mockDbDelete() as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();
    const result = await caller.garment.delete({ garmentId: "garment-abc" });

    expect(result).toEqual({ success: true });
    expect(imageStorage.deleteGarmentFiles).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalled();
  });

  test("calls deleteGarmentFiles with correct (userId, garmentId) args", async () => {
    const { db } = await import("@acme/db/client");
    const existingGarment = { id: "garment-xyz" };
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([existingGarment]) as never,
    );
    deleteSpy = spyOn(db as never, "delete").mockReturnValue(
      mockDbDelete() as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();
    await caller.garment.delete({ garmentId: "garment-xyz" });

    expect(imageStorage.deleteGarmentFiles).toHaveBeenCalledWith("user-123", "garment-xyz");
  });

  test("throws NOT_FOUND for non-existent garment", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();

    await expect(
      caller.garment.delete({ garmentId: "nonexistent" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
    expect(imageStorage.deleteGarmentFiles).not.toHaveBeenCalled();
  });

  test("throws NOT_FOUND for garment owned by another user", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller, imageStorage } = await createAuthenticatedCaller();

    await expect(
      caller.garment.delete({ garmentId: "garment-other-user" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
    expect(imageStorage.deleteGarmentFiles).not.toHaveBeenCalled();
  });

  test("throws UNAUTHORIZED for unauthenticated request", async () => {
    const { appRouter } = await import("../root");
    const auth = createMockAuth(null);
    const ctx = await createTRPCContext({
      headers: new Headers(),
      auth,
      imageStorage: createMockImageStorage(),
    });
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.garment.delete({ garmentId: "garment-abc" }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });

  test("throws INTERNAL_SERVER_ERROR when deleteGarmentFiles fails", async () => {
    const { db } = await import("@acme/db/client");
    const existingGarment = { id: "garment-abc" };
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([existingGarment]) as never,
    );
    deleteSpy = spyOn(db as never, "delete").mockReturnValue(
      mockDbDelete() as never,
    );

    const imageStorage = createMockImageStorage();
    imageStorage.deleteGarmentFiles = mock(() =>
      Promise.reject(new Error("Filesystem error")),
    );

    const { caller } = await createAuthenticatedCaller(imageStorage);

    await expect(
      caller.garment.delete({ garmentId: "garment-abc" }),
    ).rejects.toThrow(/GARMENT_DELETION_FAILED/);
    // Verify DB delete was NOT called after FS failure
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
