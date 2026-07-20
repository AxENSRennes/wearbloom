export type StoredObject = {
  key: string;
  byteCount: number;
  sha256: string;
  contentType: string;
};

export interface PrivateStorage {
  put(input: { ownerId: string; data: Uint8Array; contentType: string; extension: string }): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
