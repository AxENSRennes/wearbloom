import { mmkvStorage } from "./mmkv";

export interface QueuedUpload {
  id: string;
  imageUri: string;
  category: string;
  queuedAt: string;
}

const QUEUE_KEY = "wearbloom:upload-queue";

function getQueue(): QueuedUpload[] {
  const raw = mmkvStorage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedUpload[];
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
