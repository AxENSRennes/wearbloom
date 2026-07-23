import { describe, expect, test } from "bun:test";
import { renderInputSnapshotSchema, renderResponseSchema } from "../src/domain/render-contract";

const id = "5b927403-5ec5-4dc6-849e-f55c41a54b30";

describe("persisted render contracts", () => {
  test("accepts the current input snapshot shape", () => {
    const snapshot = renderInputSnapshotSchema.parse({
      look: { id, name: "Summer layers" },
      garments: [{ id, category: "top", name: "Purple top", assetId: id }],
      referencePhotoId: id,
    });

    expect(snapshot.garments[0]?.category).toBe("top");
  });

  test("rejects malformed or stale input snapshots", () => {
    expect(() =>
      renderInputSnapshotSchema.parse({
        look: { id, name: "Summer layers" },
        garments: [{ id, category: "shirt", name: "Purple top" }],
        referencePhotoId: id,
      }),
    ).toThrow();
  });

  test("rejects malformed cached render responses", () => {
    expect(() =>
      renderResponseSchema.parse({
        id,
        lookId: id,
        status: "done",
        resultURL: null,
        errorCode: null,
        createdAt: "not-a-date",
        completedAt: null,
      }),
    ).toThrow();
  });
});
