import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  IMAGES_DIR: z.string().default("/data/images"),
  REPLICATE_API_TOKEN: z.string().default(""),
});

const authEnvVars = authEnv();

export const env = {
  ...serverSchema.parse(process.env),
  ...authEnvVars,
};
