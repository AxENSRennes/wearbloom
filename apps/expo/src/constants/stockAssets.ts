import type { ImageSourcePropType } from "react-native";

import type { GarmentCategory } from "./categories";

export type { GarmentCategory };

export interface StockGarment {
  id: string;
  source: ImageSourcePropType;
  category: GarmentCategory;
  label: string;
}

/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves require() at build time for image assets */
export const STOCK_BODY_PHOTO =
  require("../../assets/stock/body/stock-body-01.jpg") as ImageSourcePropType;
export const STOCK_GARMENTS: StockGarment[] = [
  {
    id: "stock-tops-01",
    source:
      require("../../assets/stock/garments/stock-garment-tops-01.jpg") as ImageSourcePropType,
    category: "tops",
    label: "White T-Shirt",
  },
  {
    id: "stock-tops-02",
    source:
      require("../../assets/stock/garments/stock-garment-tops-02.jpg") as ImageSourcePropType,
    category: "tops",
    label: "Blue Blouse",
  },
  {
    id: "stock-bottoms-01",
    source:
      require("../../assets/stock/garments/stock-garment-bottoms-01.jpg") as ImageSourcePropType,
    category: "bottoms",
    label: "Chinos",
  },
  {
    id: "stock-bottoms-02",
    source:
      require("../../assets/stock/garments/stock-garment-bottoms-02.jpg") as ImageSourcePropType,
    category: "bottoms",
    label: "Denim Jeans",
  },
  {
    id: "stock-dresses-01",
    source:
      require("../../assets/stock/garments/stock-garment-dresses-01.jpg") as ImageSourcePropType,
    category: "dresses",
    label: "Summer Dress",
  },
  {
    id: "stock-dresses-02",
    source:
      require("../../assets/stock/garments/stock-garment-dresses-02.jpg") as ImageSourcePropType,
    category: "dresses",
    label: "Evening Dress",
  },
  {
    id: "stock-outerwear-01",
    source:
      require("../../assets/stock/garments/stock-garment-outerwear-01.jpg") as ImageSourcePropType,
    category: "outerwear",
    label: "Bomber Jacket",
  },
  {
    id: "stock-shoes-01",
    source:
      require("../../assets/stock/garments/stock-garment-shoes-01.jpg") as ImageSourcePropType,
    category: "shoes",
    label: "Sneakers",
  },
];
/* eslint-enable @typescript-eslint/no-require-imports */
