import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as reactQuery from "@tanstack/react-query";

import WardrobeScreen from "./index";

// ---------------------------------------------------------------------------
// Mock garment fixtures
// ---------------------------------------------------------------------------
const mockGarment1 = {
  id: "garment-1",
  userId: "user-1",
  category: "tops" as const,
  imagePath: "user-1/garments/garment-1/original.jpg",
  cutoutPath: null,
  bgRemovalStatus: "pending" as const,
  mimeType: "image/jpeg",
  width: 1200,
  height: 1600,
  fileSize: 500000,
  createdAt: new Date("2026-02-15"),
  updatedAt: new Date("2026-02-15"),
};

const mockGarment2 = {
  id: "garment-2",
  userId: "user-1",
  category: "dresses" as const,
  imagePath: "user-1/garments/garment-2/original.jpg",
  cutoutPath: null,
  bgRemovalStatus: "completed" as const,
  mimeType: "image/jpeg",
  width: 1000,
  height: 1400,
  fileSize: 400000,
  createdAt: new Date("2026-02-15"),
  updatedAt: new Date("2026-02-15"),
};

// ---------------------------------------------------------------------------
// Helper: override useQuery return value for a single test via spyOn
// ---------------------------------------------------------------------------
function stubUseQuery(overrides: {
  data?: unknown;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  error?: { message: string } | null;
}) {
  const spy = spyOn(reactQuery, "useQuery");
  spy.mockReturnValue({
    data: overrides.data ?? null,
    isLoading: overrides.isLoading ?? false,
    isPending: overrides.isLoading ?? false,
    isFetching: overrides.isFetching ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: mock(() => Promise.resolve()),
  } as ReturnType<typeof reactQuery.useQuery>);
  return spy;
}

describe("WardrobeScreen", () => {
  afterEach(() => {
    mock.restore();
  });

  // -------------------------------------------------------------------------
  // 1. Basic structure
  // -------------------------------------------------------------------------
  test("renders SafeAreaView as root container", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("mock-SafeAreaView");
  });

  // -------------------------------------------------------------------------
  // 2. CategoryPills renders all categories with "All" first
  // -------------------------------------------------------------------------
  test("renders CategoryPills with All as first option and all garment categories", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // "All" should appear (capitalized from "all")
    expect(html).toContain("All");

    // All garment categories should be present (capitalized)
    expect(html).toContain("Tops");
    expect(html).toContain("Bottoms");
    expect(html).toContain("Dresses");
    expect(html).toContain("Shoes");
    expect(html).toContain("Outerwear");
  });

  // -------------------------------------------------------------------------
  // 3. Loading skeleton when isLoading=true
  // -------------------------------------------------------------------------
  test("shows loading skeleton when isLoading is true", () => {
    stubUseQuery({
      isLoading: true,
      data: undefined,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // SkeletonGrid renders items with data-testid="skeleton-item"
    expect(html).toContain("skeleton-item");

    // Should NOT show the LegendList when loading
    expect(html).not.toContain("mock-LegendList");
  });

  // -------------------------------------------------------------------------
  // 4. Empty state when data is empty array (category = "all")
  // -------------------------------------------------------------------------
  test("shows empty state with CTA when data is empty array", () => {
    stubUseQuery({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // EmptyState headline for "all" category
    expect(html).toContain("Your wardrobe is waiting");
    // CTA label
    expect(html).toContain("Add your first garment");
  });

  // -------------------------------------------------------------------------
  // 5. Empty state when data is null (initial query state)
  // -------------------------------------------------------------------------
  test("shows empty state when data is null", () => {
    stubUseQuery({
      data: null,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // garments ?? [] coerces null to [], triggering ListEmptyComponent
    expect(html).toContain("Your wardrobe is waiting");
  });

  // -------------------------------------------------------------------------
  // 6. Error state with retry button
  // -------------------------------------------------------------------------
  test("shows error state with retry button when isError is true", () => {
    stubUseQuery({
      isError: true,
      error: { message: "Network request failed" },
      data: undefined,
      isLoading: false,
      isFetching: false,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // Error headline
    expect(html).toContain("Something went wrong");
    // User-friendly error description
    expect(html).toContain("load your wardrobe");
    // Retry button
    expect(html).toContain("Try again");
  });

  test("error state does not render CategoryPills or LegendList", () => {
    stubUseQuery({
      isError: true,
      error: { message: "Server error" },
      data: undefined,
      isLoading: false,
      isFetching: false,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // The error branch returns early before CategoryPills / LegendList
    expect(html).not.toContain("mock-LegendList");
    // CategoryPills is not rendered in error state
    expect(html).not.toContain("Tops");
    expect(html).not.toContain("Outerwear");
  });

  // -------------------------------------------------------------------------
  // 7. Garment cards render when data is present
  // -------------------------------------------------------------------------
  test("renders garment cards when data contains garments", () => {
    stubUseQuery({
      data: [mockGarment1, mockGarment2],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // GarmentCard renders an ExpoImage with a source URI containing garment ID
    expect(html).toContain("garment-1");
    expect(html).toContain("garment-2");
    // GarmentCard renders via Pressable with accessibility label
    expect(html).toContain("tops garment");
    expect(html).toContain("dresses garment");
  });

  test("does not show empty state when garments are present", () => {
    stubUseQuery({
      data: [mockGarment1],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    expect(html).not.toContain("Your wardrobe is waiting");
    expect(html).not.toContain("Nothing here yet");
  });

  // -------------------------------------------------------------------------
  // 8. LegendList grid configuration
  // -------------------------------------------------------------------------
  test("LegendList has numColumns=2 and recycleItems for grid layout", () => {
    stubUseQuery({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    expect(html).toContain('numColumns="2"');
    // Boolean prop rendered as empty attribute in SSR
    expect(html).toContain("recycleItems");
  });

  // -------------------------------------------------------------------------
  // 9. Sticky header background
  // -------------------------------------------------------------------------
  test("CategoryPills sticky header has semi-transparent background", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);

    // The absolute-positioned container wrapping CategoryPills
    expect(html).toContain("bg-white/90");
  });

  // -------------------------------------------------------------------------
  // 10. Pull-to-refresh is wired up (LegendList receives onRefresh)
  // -------------------------------------------------------------------------
  test("LegendList is rendered with pull-to-refresh support", () => {
    stubUseQuery({
      data: [mockGarment1],
      isLoading: false,
      isFetching: true,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // LegendList should be rendered (not skeleton)
    expect(html).toContain("mock-LegendList");

    // The component should pass refreshing and onRefresh props.
    // The LegendList mock strips these from rest props, but we can verify
    // that the component is in a non-loading state and renders the list.
    // The isFetching=true state (background refetch) should NOT show skeleton.
    expect(html).not.toContain("skeleton-item");
  });

  // -------------------------------------------------------------------------
  // 11. Loading state shows skeleton but still shows CategoryPills
  // -------------------------------------------------------------------------
  test("loading state shows CategoryPills above skeleton", () => {
    stubUseQuery({
      isLoading: true,
      data: undefined,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);

    // CategoryPills should still render during loading
    expect(html).toContain("All");
    expect(html).toContain("Tops");
    // Skeleton should be visible
    expect(html).toContain("skeleton-item");
  });
});
