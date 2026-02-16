import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod/v4";

import * as schema from "./schema";

const env = z
  .object({
    DATABASE_URL: z.string().min(1),
  })
  .parse(process.env);

const client = postgres(env.DATABASE_URL);

export const db = drizzle({
  client,
  schema,
  casing: "snake_case",
});
