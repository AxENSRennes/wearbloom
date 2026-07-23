import { createAuth } from "../src/auth";
import { loadConfig } from "../src/config";
import { createDatabase } from "../src/db/client";

const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://wearbloom:wearbloom@localhost:5432/wearbloom",
  BETTER_AUTH_SECRET: "schema-generation-only-secret-000000000000",
  BETTER_AUTH_URL: "https://api.wearbloom.app",
  PUBLIC_APP_URL: "https://wearbloom.app",
  AI_PROVIDER: "stub",
});
const { db } = createDatabase(config);

export const auth = createAuth(config, db);
export default auth;
