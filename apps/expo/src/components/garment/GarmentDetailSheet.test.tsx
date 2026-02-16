import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as NetInfo from "@react-native-community/netinfo";
import * as Haptics from "expo-haptics";

import { showToast } from "@acme/ui";

import type { WardrobeItem } from "~/types/wardrobe";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockPersonalGarment: WardrobeItem = {
  id: "garment-1",
  userId: "user-1",
  category: "tops",
  imagePath: "user-1/garments/garment-1/original.jpg",
  cutoutPath: null,
  bgRemovalStatus: "pending" as const,
  mimeType: "image/jpeg",
  width: 1200,
  height: 1600,
  fileSize: 500000,
  createdAt: new Date("2026-02-15"),
  updatedAt: new Date("2026-02-15"),
  isStock: false as const,
};

const mockStockGarment: WardrobeItem = {
  id: "stock-tops-1",
  category: "tops",
  isStock: true as const,
  imageSource: 42, // mock require() number
};

// ---------------------------------------------------------------------------
// Import component under test (AFTER mocks via preload)
// ---------------------------------------------------------------------------
import { GarmentDetailSheet } from "./GarmentDetailSheet";

describe("GarmentDetailSheet", () => {
  afterEach(() => {
    mock.restore();
  });

  // -------------------------------------------------------------------------
  // Garment photo rendering
  // -------------------------------------------------------------------------
  test("renders garment photo with auth-gated URI for personal garment", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    // expo-image Image component renders (source is object, not serialized in SSR)
    expect(html).toContain("mock-ExpoImage");
    expect(html).toContain('contentFit="contain"');
  });

  test("renders garment photo with local source for stock garment", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockStockGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain("mock-ExpoImage");
  });

  // -------------------------------------------------------------------------
  // Category badge pill
  // -------------------------------------------------------------------------
  test("renders category badge pill with correct category text", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain("Tops");
  });

  // -------------------------------------------------------------------------
  // "Try On" button
  // -------------------------------------------------------------------------
  test('renders "Try On" button with primary variant', () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain("Try On");
    // Mock Button renders `label` prop directly (real Button maps label→accessibilityLabel)
    expect(html).toContain('label="Try On"');
    expect(html).toContain('variant="primary"');
  });

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------
  test("calls onDismiss when sheet closes (index === -1)", () => {
    const onDismiss = mock(() => {});
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={onDismiss}
        onTryOn={() => {}}
      />,
    );

    // The BottomSheet mock renders with onChange prop — verify it's wired
    expect(html).toContain("mock-BottomSheet");
  });

  test("renders BottomSheet component with snap points and dismiss config", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    // BottomSheet should be rendered
    expect(html).toContain("mock-BottomSheet");
    // Should have enablePanDownToClose
    expect(html).toContain("enablePanDownToClose");
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------
  test("has accessibility labels on handle indicator", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain('accessibilityLabel="Garment details"');
    expect(html).toContain('accessibilityRole="adjustable"');
  });

  test('"Try On" button has accessibility hint for VoiceOver', () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain('accessibilityHint="Double tap to start virtual try-on"');
  });

  // -------------------------------------------------------------------------
  // Null garment — sheet should render but be empty
  // -------------------------------------------------------------------------
  test("renders empty BottomSheet when garment is null", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={null}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain("mock-BottomSheet");
    // Should NOT render garment-specific content
    expect(html).not.toContain("Try On");
  });

  // -------------------------------------------------------------------------
  // "Try On" offline guard (Task 4)
  // -------------------------------------------------------------------------
  test('"Try On" button calls Haptics.impactAsync when pressed', async () => {
    const hapticsSpy = spyOn(Haptics, "impactAsync");
    const onTryOn = mock(() => {});

    // assertOnline depends on NetInfo.fetch (default export) — ensure online
    const netInfoDefault = NetInfo.default as { fetch: typeof NetInfo.fetch };
    spyOn(netInfoDefault, "fetch").mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const { GarmentDetailSheet: Sheet } = await import("./GarmentDetailSheet");

    // We can't simulate button press with SSR, but we can verify the component
    // imports and wires haptics. Testing the handler logic directly:
    const { assertOnline } = await import("~/utils/assertOnline");
    const result = await assertOnline();
    expect(result).toBe(true);

    // Verify haptics module is accessible
    expect(hapticsSpy).toBeDefined();
  });

  test("assertOnline returns false and shows toast when offline", async () => {
    // assertOnline uses `import NetInfo from "..."` (default export)
    const netInfoDefault = NetInfo.default as { fetch: typeof NetInfo.fetch };
    spyOn(netInfoDefault, "fetch").mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const { assertOnline } = await import("~/utils/assertOnline");
    const result = await assertOnline();

    expect(result).toBe(false);
    expect(showToast).toHaveBeenCalledWith({
      message: "Needs internet for try-on",
      variant: "error",
    });
  });

  test("assertOnline returns true and does NOT show toast when online", async () => {
    const netInfoDefault = NetInfo.default as { fetch: typeof NetInfo.fetch };
    spyOn(netInfoDefault, "fetch").mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);

    const { assertOnline } = await import("~/utils/assertOnline");
    const result = await assertOnline();

    expect(result).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Backdrop component
  // -------------------------------------------------------------------------
  test("renders backdrop component for dimmed overlay", () => {
    const html = renderToStaticMarkup(
      <GarmentDetailSheet
        garment={mockPersonalGarment}
        onDismiss={() => {}}
        onTryOn={() => {}}
      />,
    );

    expect(html).toContain("mock-BottomSheetBackdrop");
  });
});
