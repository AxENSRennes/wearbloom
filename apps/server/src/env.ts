import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  ANONYMOUS_SESSION_TTL_HOURS: z.coerce.number().default(24),
  ANONYMOUS_MAX_RENDERS: z.coerce.number().default(1),
});

const authEnvVars = authEnv();

export const env = {
  ...serverSchema.parse(process.env),
  ...authEnvVars,
};
