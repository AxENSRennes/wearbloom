import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { AppConfig } from "../config";
import * as schema from "./schema";

export function createDatabase(config: AppConfig) {
  const client = postgres(config.DATABASE_URL, { max: config.ROLE === "worker" ? 4 : 10 });
  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDatabase>["db"];
