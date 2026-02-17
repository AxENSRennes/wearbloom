/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
import type { CategoryFilter, GarmentCategory } from "./categories";

export interface StockGarment {
  readonly id: string;
  readonly category: GarmentCategory;
  readonly isStock: true;
  readonly imageSource: number;
}

export const STOCK_GARMENTS: readonly StockGarment[] = [
  {
    id: "stock-tops-1",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-tops-1.png"),
  },
  {
    id: "stock-tops-2",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-tops-2.png"),
  },
  {
    id: "stock-tops-3",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-tops-3.png"),
  },
  {
    id: "stock-bottoms-1",
    category: "bottoms",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-bottoms-1.png"),
  },
  {
    id: "stock-bottoms-2",
    category: "bottoms",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-bottoms-2.png"),
  },
  {
    id: "stock-dresses-1",
    category: "dresses",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-dresses-1.png"),
  },
  {
    id: "stock-dresses-2",
    category: "dresses",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-dresses-2.png"),
  },
  {
    id: "stock-outerwear-1",
    category: "outerwear",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-outerwear-1.png"),
  },
];

export function getStockGarmentsByCategory(
  category?: CategoryFilter,
): readonly StockGarment[] {
  if (!category || category === "all") return STOCK_GARMENTS;
  return STOCK_GARMENTS.filter((g) => g.category === category);
}
