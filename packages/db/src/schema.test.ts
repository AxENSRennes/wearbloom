import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";

import {
  BG_REMOVAL_STATUSES,
  FEEDBACK_RATINGS,
  GARMENT_CATEGORIES,
  RENDER_STATUSES,
  TRYON_PROVIDERS,
  bgRemovalStatusEnum,
  feedbackRating,
  garmentCategory,
  garments,
  renderFeedback,
  renderStatus,
  tryOnProviderEnum,
  tryOnRenders,
  users,
} from "./schema";

describe("users schema", () => {
  test("has isAnonymous column", () => {
    const columns = getTableColumns(users);
    expect(columns.isAnonymous).toBeDefined();
  });

  test("isAnonymous defaults to false", () => {
    const columns = getTableColumns(users);
    expect(columns.isAnonymous.hasDefault).toBe(true);
  });
});

describe("garments schema", () => {
  test("garments table export exists", () => {
    expect(garments).toBeDefined();
  });

  test("garmentCategory enum export exists", () => {
    expect(garmentCategory).toBeDefined();
  });

  test("garments table has expected columns", () => {
    const columnNames = Object.keys(garments);
    const expected = [
      "id",
      "userId",
      "category",
      "imagePath",
      "cutoutPath",
      "bgRemovalStatus",
      "mimeType",
      "width",
      "height",
      "fileSize",
      "createdAt",
      "updatedAt",
    ];
    for (const col of expected) {
      expect(columnNames).toContain(col);
    }
  });

  test("garmentCategory enum has 5 values", () => {
    expect(garmentCategory.enumValues).toEqual([
      "tops",
      "bottoms",
      "dresses",
      "shoes",
      "outerwear",
    ]);
  });

  test("GARMENT_CATEGORIES has correct values", () => {
    expect(GARMENT_CATEGORIES).toEqual(["tops", "bottoms", "dresses", "shoes", "outerwear"]);
  });

  test("bgRemovalStatusEnum has correct values", () => {
    expect(bgRemovalStatusEnum.enumValues).toEqual([
      "pending",
      "completed",
      "failed",
      "skipped",
    ]);
  });

  test("BG_REMOVAL_STATUSES has correct values", () => {
    expect(BG_REMOVAL_STATUSES).toEqual(["pending", "completed", "failed", "skipped"]);
  });
});

describe("tryOnRenders schema", () => {
  test("RENDER_STATUSES contains all expected values", () => {
    expect(RENDER_STATUSES).toEqual([
      "pending",
      "processing",
      "completed",
      "failed",
    ]);
  });

  test("TRYON_PROVIDERS contains all expected values", () => {
    expect(TRYON_PROVIDERS).toEqual([
      "fal_fashn",
      "fal_nano_banana",
      "google_vto",
    ]);
  });

  test("renderStatus pgEnum is defined", () => {
    expect(renderStatus).toBeDefined();
    expect(renderStatus.enumName).toBe("render_status");
    expect(renderStatus.enumValues).toEqual([
      "pending",
      "processing",
      "completed",
      "failed",
    ]);
  });

  test("tryOnProviderEnum pgEnum is defined", () => {
    expect(tryOnProviderEnum).toBeDefined();
    expect(tryOnProviderEnum.enumName).toBe("try_on_provider");
    expect(tryOnProviderEnum.enumValues).toEqual([
      "fal_fashn",
      "fal_nano_banana",
      "google_vto",
    ]);
  });

  test("tryOnRenders table is defined with expected columns", () => {
    expect(tryOnRenders).toBeDefined();

    const columnNames = Object.keys(tryOnRenders);
    const expected = [
      "id",
      "userId",
      "garmentId",
      "provider",
      "status",
      "jobId",
      "resultPath",
      "errorCode",
      "creditConsumed",
      "createdAt",
      "updatedAt",
    ];
    for (const col of expected) {
      expect(columnNames).toContain(col);
    }
  });

  test("tryOnRenders table has creditConsumed column", () => {
    const columnNames = Object.keys(tryOnRenders);
    expect(columnNames).toContain("creditConsumed");
  });
});

describe("renderFeedback schema", () => {
  test("FEEDBACK_RATINGS has correct values", () => {
    expect(FEEDBACK_RATINGS).toEqual(["thumbs_up", "thumbs_down"]);
  });

  test("feedbackRating pgEnum is defined", () => {
    expect(feedbackRating).toBeDefined();
    expect(feedbackRating.enumName).toBe("feedback_rating");
    expect(feedbackRating.enumValues).toEqual(["thumbs_up", "thumbs_down"]);
  });

  test("renderFeedback table is defined with expected columns", () => {
    expect(renderFeedback).toBeDefined();

    const columnNames = Object.keys(renderFeedback);
    const expected = [
      "id",
      "renderId",
      "userId",
      "rating",
      "category",
      "createdAt",
    ];
    for (const col of expected) {
      expect(columnNames).toContain(col);
    }
  });
});
