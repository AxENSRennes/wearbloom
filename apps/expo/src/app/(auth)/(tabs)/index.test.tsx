import * as NetInfo from "@react-native-community/netinfo";
import * as reactQuery from "@tanstack/react-query";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import WardrobeScreen from "~/components/garment/WardrobeScreen";

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

function stubUseQuery(overrides: {
  data?: unknown;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  error?: { message: string } | null;
}) {
  const spy = spyOn(reactQuery, "useQuery");
  let callCount = 0;
  spy.mockImplementation((() => {
    callCount++;
    if (callCount === 1) {
      return {
        data: ["tops", "bottoms", "dresses"],
        isLoading: false,
        isPending: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: mock(() => Promise.resolve()),
      };
    }
    return {
      data: overrides.data ?? null,
      isLoading: overrides.isLoading ?? false,
      isPending: overrides.isLoading ?? false,
      isFetching: overrides.isFetching ?? false,
      isError: overrides.isError ?? false,
      error: overrides.error ?? null,
      refetch: mock(() => Promise.resolve()),
    };
  }) as unknown as typeof reactQuery.useQuery);
  return spy;
}

describe("WardrobeScreen", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders with Carousel pager and LegendList per page", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("mock-SafeAreaView");
    expect(html).toContain("mock-Carousel");
    expect(html).toContain("mock-LegendList");
  });

  test("renders all category pills with all first", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("All");
    expect(html).toContain("Tops");
    expect(html).toContain("Bottoms");
    expect(html).toContain("Dresses");
    expect(html).toContain("Shoes");
    expect(html).toContain("Outerwear");
  });

  test("pills are inside a horizontal ScrollView", () => {
    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("mock-ScrollView");
    expect(html).toContain('horizontal=""');
  });

  test("loading state renders skeleton in list empty component", () => {
    stubUseQuery({
      isLoading: true,
      data: undefined,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("mock-LegendList");
    expect(html).toContain("skeleton-item");
  });

  test("error state renders retry UI and no carousel", () => {
    stubUseQuery({
      isError: true,
      error: { message: "Server error" },
      data: undefined,
      isLoading: false,
      isFetching: false,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).not.toContain("mock-Carousel");
  });

  test("each carousel page has a LegendList with 2-column grid and recycling", () => {
    stubUseQuery({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain('numColumns="2"');
    expect(html).toContain("recycleItems");
    expect(html).toContain("alwaysBounceVertical");
    expect(html).toContain('scrollEventThrottle="16"');
  });

  test("renders personal garments and merged stock garments", () => {
    stubUseQuery({
      data: [mockGarment1, mockGarment2],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("garment-1");
    expect(html).toContain("garment-2");
    expect(html).toContain("stock-tops-01");
  });

  test("unsupported categories display no-try-on helper", () => {
    stubUseQuery({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("No try-on");
  });

  test("offline indicator shown when disconnected", () => {
    spyOn(NetInfo, "useNetInfo").mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      type: "none",
    } as ReturnType<typeof NetInfo.useNetInfo>);

    stubUseQuery({
      data: [mockGarment1],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("Offline");
  });

  test("renders dialogs and garment detail sheet", () => {
    stubUseQuery({
      data: [mockGarment1],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });

    const html = renderToStaticMarkup(<WardrobeScreen />);
    expect(html).toContain("Delete Garment");
    expect(html).toContain("Hide stock garment?");
    expect(html).toContain("mock-BottomSheet");
  });

  test("source keeps paywall/body-photo/invalid-category protections", async () => {
    const source = await Bun.file(
      import.meta.dir + "/../../../components/garment/WardrobeScreen.tsx",
    ).text();
    expect(source).toContain("guardRender(garmentId)");
    expect(source).toContain('err.message === "INVALID_CATEGORY"');
    expect(source).toContain('err.message === "NO_BODY_PHOTO"');
    expect(source).toContain(
      "/(auth)/paywall?garmentId=${encodeURIComponent(garmentId)}",
    );
  });
});
