import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import type { PrivateStorage, StoredObject } from "./storage";

export class LocalPrivateStorage implements PrivateStorage {
  constructor(private readonly root: string) {}

  async put(input: { ownerId: string; data: Uint8Array; contentType: string; extension: string }): Promise<StoredObject> {
    const digest = new Bun.CryptoHasher("sha256").update(input.data).digest("hex");
    const key = join(input.ownerId, `${crypto.randomUUID()}-${digest.slice(0, 12)}.${input.extension}`);
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, input.data);
    return { key, byteCount: input.data.byteLength, sha256: digest, contentType: input.contentType };
  }

  async get(key: string): Promise<Uint8Array> {
    return new Uint8Array(await Bun.file(this.resolve(key)).arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await Bun.file(this.resolve(key)).delete();
  }

  private resolve(key: string): string {
    const relative = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    const path = join(this.root, relative);
    if (!path.startsWith(normalize(this.root))) throw new Error("Invalid storage key");
    return path;
  }
}
