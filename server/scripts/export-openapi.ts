import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { StubGarmentDetector } from "../src/ai/detection";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import { loadConfig } from "../src/config";
import { createDatabase } from "../src/db/client";
import { LocalPrivateStorage } from "../src/storage/local-storage";
import { AppAttestVerifier } from "../src/security/app-attest";
import { RateLimiter } from "../src/security/rate-limit";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://wearbloom:wearbloom@localhost:5432/wearbloom",
  BETTER_AUTH_SECRET: "openapi-generation-only-secret-000000000000",
  BETTER_AUTH_URL: "https://api.wearbloom.app",
  PUBLIC_APP_URL: "https://wearbloom.app",
  AI_PROVIDER: "stub",
});
const { db, client } = createDatabase(config);
const storage = new LocalPrivateStorage("./data/openapi-placeholder");
const auth = createAuth(config, db);
const appAttest = new AppAttestVerifier(config, db);
const rateLimiter = new RateLimiter(db);
const app = createApp({ config, db, storage, detector: new StubGarmentDetector(), auth, appAttest, rateLimiter });
const response = await app.request("/openapi.json");
if (!response.ok) throw new Error(`OpenAPI generation failed: ${response.status}`);
const document = `${JSON.stringify(await response.json(), null, 2)}\n`;
const destinations = [
  resolve(import.meta.dir, "../../openapi/wearbloom-v1.json"),
  resolve(import.meta.dir, "../../WearBloomContract/Sources/WearBloomContract/openapi.json"),
];
for (const destination of destinations) {
  await mkdir(dirname(destination), { recursive: true });
  await Bun.write(destination, document);
}
await client.end();
console.log(destinations.join("\n"));
