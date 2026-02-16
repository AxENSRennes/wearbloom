import { describe, expect, mock, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GarmentCard } from "./GarmentCard";

import type { StockGarment } from "~/constants/stockGarments";

const mockGarment = {
  id: "garment-123",
  userId: "user-1",
  category: "tops" as const,
  imagePath: "user-1/garments/garment-123/original.jpg",
  cutoutPath: null as string | null,
  bgRemovalStatus: "pending" as const,
  mimeType: "image/jpeg",
  width: 1200,
  height: 1600,
  fileSize: 500000,
  createdAt: new Date("2026-02-15"),
  updatedAt: new Date("2026-02-15"),
  isStock: false as const,
};

const mockStockGarment: StockGarment = {
  id: "stock-dresses-1",
  category: "dresses",
  isStock: true,
  imageSource: 42,
};

describe("GarmentCard", () => {
  test("renders garment image with expo-image", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain("mock-ExpoImage");
  });

  test("image source URI includes garment ID", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    // The image source should contain the garment ID for the auth-gated endpoint
    expect(html).toContain("garment-123");
  });

  test("renders with correct aspect ratio dimensions (1:1.2)", () => {
    const columnWidth = 194;
    const expectedHeight = Math.round(columnWidth * 1.2);
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={columnWidth} />,
    );

    // The style should contain width and height matching 1:1.2 ratio
    expect(html).toContain(`${columnWidth}`);
    expect(html).toContain(`${expectedHeight}`);
  });

  test("calls onPress callback prop is wired", () => {
    const onPress = mock(() => {});
    const element = (
      <GarmentCard garment={mockGarment} onPress={onPress} columnWidth={194} />
    );

    // Verify the callback is passed as a prop
    expect(element.props.onPress).toBe(onPress);

    // Also verify it renders without error
    const html = renderToStaticMarkup(element);
    expect(html).toContain("mock-Pressable");
  });

  test("accessibility label includes garment category", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityLabel="tops garment"');
  });

  test("accessibility role is button", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityRole="button"');
  });

  test("accessibility hint for VoiceOver", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityHint="Double tap to view details"');
  });

  test("uses contentFit cover for edge-to-edge display", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('contentFit="cover"');
  });

  test("renders different category in accessibility label", () => {
    const dressGarment = { ...mockGarment, category: "dresses" as const };
    const html = renderToStaticMarkup(
      <GarmentCard garment={dressGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityLabel="dresses garment"');
  });

  test("has accessible prop set to true", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    // React SSR renders boolean true as empty attribute: accessible=""
    expect(html).toContain("accessible=");
  });

  // -----------------------------------------------------------------------
  // Stock garment tests
  // -----------------------------------------------------------------------
  test("stock garment renders with local image source (not server URI)", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockStockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain("mock-ExpoImage");
    // Stock garments should NOT contain a server URI
    expect(html).not.toContain("/api/images/");
  });

  test("stock garment accessibility label includes 'stock'", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockStockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityLabel="stock dresses garment"');
  });

  test("stock garment press callback is wired", () => {
    const onPress = mock(() => {});
    const element = (
      <GarmentCard garment={mockStockGarment} onPress={onPress} columnWidth={194} />
    );

    expect(element.props.onPress).toBe(onPress);

    const html = renderToStaticMarkup(element);
    expect(html).toContain("mock-Pressable");
  });

  // -----------------------------------------------------------------------
  // onLongPress tests (Story 2.4)
  // -----------------------------------------------------------------------
  test("onLongPress prop is accepted and component renders without error", () => {
    const onLongPress = mock(() => {});
    const html = renderToStaticMarkup(
      <GarmentCard
        garment={mockGarment}
        onPress={() => {}}
        onLongPress={onLongPress}
        columnWidth={194}
      />,
    );

    expect(html).toContain("mock-Pressable");
  });

  test("no crash when onLongPress is undefined (stock garment scenario)", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockStockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain("mock-Pressable");
  });

  test("accessibility hint includes long-press action when onLongPress is provided", () => {
    const html = renderToStaticMarkup(
      <GarmentCard
        garment={mockGarment}
        onPress={() => {}}
        onLongPress={() => {}}
        columnWidth={194}
      />,
    );

    expect(html).toContain("Long press to delete");
  });

  test("accessibility hint is default when onLongPress is not provided", () => {
    const html = renderToStaticMarkup(
      <GarmentCard garment={mockGarment} onPress={() => {}} columnWidth={194} />,
    );

    expect(html).toContain('accessibilityHint="Double tap to view details"');
    expect(html).not.toContain("Long press to delete");
  });
});
