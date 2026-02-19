import type { GarmentCategory } from "~/constants/categories";
import { isGarmentCategory } from "~/constants/categories";
import { mmkvStorage } from "./mmkv";

export interface QueuedUpload {
  id: string;
  imageUri: string;
  category: GarmentCategory;
  width: number;
  height: number;
  queuedAt: string;
}

function isQueuedUpload(item: unknown): item is QueuedUpload {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  const isKnownCategory =
    typeof obj.category === "string" && isGarmentCategory(obj.category);
  return (
    typeof obj.id === "string" &&
    typeof obj.imageUri === "string" &&
    isKnownCategory &&
    typeof obj.width === "number" &&
    typeof obj.height === "number" &&
    typeof obj.queuedAt === "string"
  );
}

const QUEUE_KEY = "wearbloom:upload-queue";

function getQueue(): QueuedUpload[] {
  const raw = mmkvStorage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedUpload);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedUpload[]): void {
  mmkvStorage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueUpload(payload: QueuedUpload): void {
  const current = getQueue();
  current.push(payload);
  saveQueue(current);
}

export async function processQueue(
  uploadFn: (payload: QueuedUpload) => Promise<void>,
): Promise<number> {
  const queue = getQueue();
  let processed = 0;
  const remaining: QueuedUpload[] = [];

  for (const item of queue) {
    try {
      await uploadFn(item);
      processed++;
    } catch {
      remaining.push(item);
    }
  }

  saveQueue(remaining);
  return processed;
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function clearQueue(): void {
  mmkvStorage.remove(QUEUE_KEY);
}
