import { z } from "zod";

export const categorySchema = z.enum(["top", "bottom", "dress", "outerwear"]);
export type Category = z.infer<typeof categorySchema>;

export type CompositionPiece = { id: string; category: Category };

export function validateComposition(pieces: CompositionPiece[]): void {
  if (pieces.length === 0) throw new Error("LOOK_EMPTY");
  const categories = pieces.map((piece) => piece.category);
  if (new Set(categories).size !== categories.length) throw new Error("LOOK_DUPLICATE_CATEGORY");
  if (categories.includes("dress") && (categories.includes("top") || categories.includes("bottom"))) {
    throw new Error("LOOK_DRESS_CONFLICT");
  }
  const hasDress = categories.includes("dress");
  const hasSeparates = categories.includes("top") && categories.includes("bottom");
  if (!hasDress && !hasSeparates) throw new Error("LOOK_INCOMPLETE");
}
