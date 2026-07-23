import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import * as schema from "../db/schema";
import type { Category } from "./categories";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function upsertOwnedGarment(
  database: Pick<Transaction, "insert">,
  input: { id: string; ownerId: string; name: string; category: Category; assetId: string; now: Date },
): Promise<boolean> {
  const [saved] = await database
    .insert(schema.garments)
    .values({
      id: input.id,
      ownerId: input.ownerId,
      name: input.name,
      category: input.category,
      originalAssetId: input.assetId,
    })
    .onConflictDoUpdate({
      target: schema.garments.id,
      setWhere: eq(schema.garments.ownerId, input.ownerId),
      set: {
        name: input.name,
        category: input.category,
        originalAssetId: input.assetId,
        updatedAt: input.now,
      },
    })
    .returning({ id: schema.garments.id });
  return Boolean(saved);
}

export async function upsertOwnedReference(
  database: Pick<Transaction, "insert">,
  input: {
    id: string;
    ownerId: string;
    assetId: string;
    isDefault: boolean;
    generatedFromVariantId?: string;
  },
): Promise<boolean> {
  const [saved] = await database
    .insert(schema.referencePhotos)
    .values({
      id: input.id,
      ownerId: input.ownerId,
      assetId: input.assetId,
      isDefault: input.isDefault,
      ...(input.generatedFromVariantId ? { generatedFromVariantId: input.generatedFromVariantId } : {}),
    })
    .onConflictDoUpdate({
      target: schema.referencePhotos.id,
      setWhere: eq(schema.referencePhotos.ownerId, input.ownerId),
      set: {
        assetId: input.assetId,
        isDefault: input.isDefault,
        generatedFromVariantId: input.generatedFromVariantId ?? null,
      },
    })
    .returning({ id: schema.referencePhotos.id });
  return Boolean(saved);
}

export async function upsertOwnedLook(
  database: Pick<Transaction, "insert" | "delete">,
  input: {
    id: string;
    ownerId: string;
    name: string;
    note: string;
    garments: Array<{ id: string; category: Category }>;
    now: Date;
  },
): Promise<boolean> {
  const [saved] = await database
    .insert(schema.looks)
    .values({ id: input.id, ownerId: input.ownerId, name: input.name, note: input.note, updatedAt: input.now })
    .onConflictDoUpdate({
      target: schema.looks.id,
      setWhere: eq(schema.looks.ownerId, input.ownerId),
      set: { name: input.name, note: input.note, updatedAt: input.now },
    })
    .returning({ id: schema.looks.id });
  if (!saved) return false;
  await database.delete(schema.lookGarments).where(eq(schema.lookGarments.lookId, input.id));
  await database
    .insert(schema.lookGarments)
    .values(input.garments.map((piece) => ({ lookId: input.id, garmentId: piece.id, category: piece.category })));
  return true;
}
