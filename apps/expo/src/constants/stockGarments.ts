/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
import type { ImageSourcePropType } from "react-native";

import type { CategoryFilter, GarmentCategory } from "./categories";

export interface StockGarment {
  readonly id: string;
  readonly category: GarmentCategory;
  readonly isStock: true;
  readonly imageSource: number;
  readonly label: string;
}

export const STOCK_BODY_PHOTO =
  require("../../assets/stock/body/stock-body-01.jpg") as ImageSourcePropType;

export const STOCK_GARMENTS: readonly StockGarment[] = [
  {
    id: "stock-tops-01",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-tops-01.jpg"),
    label: "White T-Shirt",
  },
  {
    id: "stock-tops-02",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-tops-02.jpg"),
    label: "Blue Blouse",
  },
  {
    id: "stock-tops-03",
    category: "tops",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-tops-03.jpg"),
    label: "Classic Shirt",
  },
  {
    id: "stock-bottoms-01",
    category: "bottoms",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-bottoms-01.jpg"),
    label: "Chinos",
  },
  {
    id: "stock-bottoms-02",
    category: "bottoms",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-bottoms-02.jpg"),
    label: "Denim Jeans",
  },
  {
    id: "stock-dresses-01",
    category: "dresses",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-dresses-01.jpg"),
    label: "Summer Dress",
  },
  {
    id: "stock-dresses-02",
    category: "dresses",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-dresses-02.jpg"),
    label: "Evening Dress",
  },
  {
    id: "stock-outerwear-01",
    category: "outerwear",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-outerwear-01.jpg"),
    label: "Bomber Jacket",
  },
  {
    id: "stock-shoes-01",
    category: "shoes",
    isStock: true,
    imageSource: require("../../assets/stock/garments/stock-garment-shoes-01.jpg"),
    label: "Sneakers",
  },
];

export function getStockGarmentsByCategory(
  category?: CategoryFilter,
): readonly StockGarment[] {
  if (!category || category === "all") return STOCK_GARMENTS;
  return STOCK_GARMENTS.filter((g) => g.category === category);
}
