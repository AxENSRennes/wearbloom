import type { StockGarment } from "~/constants/stockGarments";
import type { RouterOutputs } from "~/utils/api";

export type PersonalGarment = RouterOutputs["garment"]["list"][number] & {
  isStock: false;
};

export type WardrobeItem = PersonalGarment | StockGarment;

export type { StockGarment } from "~/constants/stockGarments";

export function isStockGarment(item: WardrobeItem): item is StockGarment {
  return item.isStock;
}
