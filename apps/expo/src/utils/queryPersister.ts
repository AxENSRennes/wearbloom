import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

import { mmkvStorage } from "./mmkv";

export const clientPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string) => mmkvStorage.getString(key) ?? null,
    setItem: (key: string, value: string) => {
      mmkvStorage.set(key, value);
    },
    removeItem: (key: string) => {
      mmkvStorage.remove(key);
    },
  },
  throttleTime: 1000,
});
