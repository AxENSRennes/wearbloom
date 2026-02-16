import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AuthInstance, TryOnProviderContext } from "../trpc";
import { createTRPCContext } from "../trpc";
import {
  createMockImageStorage,
  mockDbInsert,
  mockDbSelect,
  mockDbUpdate,
} from "../../test/helpers";

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

function createMockTryOnProvider(): TryOnProviderContext {
  return {
    name: "fal_fashn",
    submitRender: mock(() => Promise.resolve({ jobId: "fal-job-123" })),
    getResult: mock(() =>
      Promise.resolve({
        imageUrl: "https://cdn.fal.media/result.png",
        contentType: "image/png",
      }),
    ),
  };
}

async function createAuthenticatedCaller(
  imageStorage = createMockImageStorage(),
  tryOnProvider: TryOnProviderContext | undefined = createMockTryOnProvider(),
  session: typeof mockSession | null = mockSession,
) {
  const { appRouter } = await import("../root");
  const auth = createMockAuth(session);
  const ctx = await createTRPCContext({
    headers: new Headers({ cookie: "session=xyz" }),
    auth,
    imageStorage,
    tryOnProvider,
  });
  return {
    caller: appRouter.createCaller(ctx),
    imageStorage,
    tryOnProvider,
    auth,
  };
}

describe("tryon.requestRender", () => {
  let selectSpy: ReturnType<typeof spyOn>;
  let insertSpy: ReturnType<typeof spyOn>;
  let updateSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    selectSpy?.mockRestore();
    insertSpy?.mockRestore();
    updateSpy?.mockRestore();
  });

  test("validates user has a body photo", async () => {
    const { db } = await import("@acme/db/client");
    // First select (bodyPhotos) returns empty — no body photo
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.requestRender({ garmentId: "garment-1" }),
    ).rejects.toThrow(/NO_BODY_PHOTO/);
  });

  test("validates garment exists and belongs to user", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(mockDbSelect([]) as never);

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.requestRender({ garmentId: "nonexistent" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
  });

  test("creates render record in DB", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "garment-1",
            imagePath: "user-123/garments/g1_original.jpg",
            cutoutPath: "user-123/garments/g1_cutout.png",
            category: "tops",
          },
        ]) as never,
      );
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("render-new") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.requestRender({ garmentId: "garment-1" });

    expect(insertSpy).toHaveBeenCalled();
    expect(result.renderId).toBe("render-new");
  });

  test("calls provider.submitRender with correct images", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "garment-1",
            imagePath: "user-123/garments/g1_original.jpg",
            cutoutPath: "user-123/garments/g1_cutout.png",
            category: "tops",
          },
        ]) as never,
      );
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("render-abc") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const tryOnProvider = createMockTryOnProvider();
    const { caller } = await createAuthenticatedCaller(
      createMockImageStorage(),
      tryOnProvider,
    );
    await caller.tryon.requestRender({ garmentId: "garment-1" });

    expect(tryOnProvider.submitRender).toHaveBeenCalledWith(
      "/data/images/user-123/body/avatar.jpg",
      "/data/images/user-123/garments/g1_cutout.png",
      { category: "tops" },
    );
  });

  test("returns renderId", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "garment-1",
            imagePath: "path.jpg",
            cutoutPath: null,
            category: "tops",
          },
        ]) as never,
      );
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("render-xyz") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.requestRender({ garmentId: "garment-1" });

    expect(result.renderId).toBe("render-xyz");
  });

  test("throws PRECONDITION_FAILED if no body photo", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.requestRender({ garmentId: "garment-1" }),
    ).rejects.toThrow(/NO_BODY_PHOTO/);
  });

  test("throws NOT_FOUND if garment missing", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(mockDbSelect([]) as never);

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.requestRender({ garmentId: "nonexistent" }),
    ).rejects.toThrow(/GARMENT_NOT_FOUND/);
  });

  test("retries once on 5xx provider error then succeeds", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "garment-1",
            imagePath: "user-123/garments/g1_original.jpg",
            cutoutPath: "user-123/garments/g1_cutout.png",
            category: "tops",
          },
        ]) as never,
      );
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("render-retry") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const tryOnProvider = createMockTryOnProvider();
    let callCount = 0;
    tryOnProvider.submitRender = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("502 Bad Gateway"));
      }
      return Promise.resolve({ jobId: "fal-job-retry" });
    });

    const { caller } = await createAuthenticatedCaller(
      createMockImageStorage(),
      tryOnProvider,
    );
    const result = await caller.tryon.requestRender({ garmentId: "garment-1" });

    expect(result.renderId).toBe("render-retry");
    expect(callCount).toBe(2);
  });

  test("does NOT retry on 422 validation error", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          { id: "bp-1", filePath: "user-123/body/avatar.jpg" },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "garment-1",
            imagePath: "user-123/garments/g1_original.jpg",
            cutoutPath: "user-123/garments/g1_cutout.png",
            category: "tops",
          },
        ]) as never,
      );
    insertSpy = spyOn(db as never, "insert").mockReturnValue(
      mockDbInsert("render-422") as never,
    );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    let callCount = 0;
    const tryOnProvider = createMockTryOnProvider();
    tryOnProvider.submitRender = mock(() => {
      callCount++;
      return Promise.reject(new Error("422 Unprocessable Entity"));
    });

    const { caller } = await createAuthenticatedCaller(
      createMockImageStorage(),
      tryOnProvider,
    );

    await expect(
      caller.tryon.requestRender({ garmentId: "garment-1" }),
    ).rejects.toThrow(/RENDER_FAILED/);

    expect(callCount).toBe(1);
  });
});

describe("tryon.getRenderStatus", () => {
  let selectSpy: ReturnType<typeof spyOn>;
  let updateSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    selectSpy?.mockRestore();
    updateSpy?.mockRestore();
  });

  test("returns current status for valid render", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "processing",
            resultPath: null,
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-1",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.status).toBe("processing");
    expect(result.resultImageUrl).toBeNull();
  });

  test("returns resultImageUrl when completed", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "completed",
            resultPath: "user-123/renders/render-abc_result.png",
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-1",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.status).toBe("completed");
    expect(result.resultImageUrl).toBe("/api/images/render/render-abc");
  });

  test("marks as failed with RENDER_TIMEOUT after 30s", async () => {
    const { db } = await import("@acme/db/client");
    const oldDate = new Date(Date.now() - 35000); // 35 seconds ago
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "pending",
            resultPath: null,
            errorCode: null,
            createdAt: oldDate,
            garmentId: "garment-1",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );
    updateSpy = spyOn(db as never, "update").mockReturnValue(
      mockDbUpdate() as never,
    );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("RENDER_TIMEOUT");
  });

  test("throws NOT_FOUND for invalid renderId", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.getRenderStatus({ renderId: "nonexistent" }),
    ).rejects.toThrow(/RENDER_NOT_FOUND/);
  });

  test("validates render belongs to user", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select").mockReturnValue(
      mockDbSelect([
        {
          id: "render-abc",
          userId: "other-user-456",
          status: "completed",
          resultPath: "path.png",
          errorCode: null,
          createdAt: new Date(),
          garmentId: "garment-1",
        },
      ]) as never,
    );

    const { caller } = await createAuthenticatedCaller();

    await expect(
      caller.tryon.getRenderStatus({ renderId: "render-abc" }),
    ).rejects.toThrow(/RENDER_NOT_FOUND/);
  });

  test("returns garmentId for all renders", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "completed",
            resultPath: "user-123/renders/render-abc_result.png",
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-42",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.garmentId).toBe("garment-42");
  });

  test("returns personImageUrl for pending/processing renders", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "processing",
            resultPath: null,
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-1",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-99" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.personImageUrl).toBe("/api/images/bp-99");
  });

  test("returns garmentImageUrl for pending/processing renders", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "pending",
            resultPath: null,
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-77",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.garmentImageUrl).toBe("/api/images/garment-77");
  });

  test("returns personImageUrl/garmentImageUrl for completed renders", async () => {
    const { db } = await import("@acme/db/client");
    selectSpy = spyOn(db as never, "select")
      .mockReturnValueOnce(
        mockDbSelect([
          {
            id: "render-abc",
            userId: "user-123",
            status: "completed",
            resultPath: "user-123/renders/render-abc_result.png",
            errorCode: null,
            createdAt: new Date(),
            garmentId: "garment-1",
          },
        ]) as never,
      )
      .mockReturnValueOnce(
        mockDbSelect([{ id: "bp-1" }]) as never,
      );

    const { caller } = await createAuthenticatedCaller();
    const result = await caller.tryon.getRenderStatus({
      renderId: "render-abc",
    });

    expect(result.personImageUrl).toBe("/api/images/bp-1");
    expect(result.garmentImageUrl).toBe("/api/images/garment-1");
  });
});
