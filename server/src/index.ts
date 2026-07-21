import OpenAI from "openai";
import { createApp } from "./app";
import { OpenAIGarmentDetector, StubGarmentDetector } from "./ai/detection";
import { createAuth } from "./auth";
import { loadConfig } from "./config";
import { createDatabase } from "./db/client";
import { LocalPrivateStorage } from "./storage/local-storage";
import { AppAttestVerifier } from "./security/app-attest";
import { RateLimiter } from "./security/rate-limit";
import { configureTelemetry } from "./telemetry";

const config = loadConfig();
configureTelemetry(config, "api");
const { db } = createDatabase(config);
const storage = new LocalPrivateStorage(config.STORAGE_ROOT);
const openai = config.AI_PROVIDER === "openai" ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : undefined;
const detector = openai ? new OpenAIGarmentDetector(openai) : new StubGarmentDetector();
const auth = createAuth(config, db);
const appAttest = new AppAttestVerifier(config, db);
const rateLimiter = new RateLimiter(db);
const app = createApp({ config, db, storage, detector, auth, appAttest, rateLimiter });

console.log(JSON.stringify({ level: "info", message: "WearBloom API starting", port: config.PORT }));

export default { port: config.PORT, fetch: app.fetch, maxRequestBodySize: 13 * 1024 * 1024 };
