import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  ANONYMOUS_SESSION_TTL_HOURS: z.coerce.number().default(24),
  ANONYMOUS_MAX_RENDERS: z.coerce.number().default(1),
  FREE_CREDITS_COUNT: z.coerce.number().int().min(0).default(3),
  // Apple IAP — optional at startup, validated at point of use
  APPLE_IAP_KEY_ID: z.string().min(1).optional(),
  APPLE_IAP_ISSUER_ID: z.string().min(1).optional(),
  APPLE_IAP_KEY_PATH: z.string().min(1).optional(),
  APPLE_APP_ID: z.coerce.number().optional(),
});

const authEnvVars = authEnv();

export const env = {
  ...serverSchema.parse(process.env),
  ...authEnvVars,
};
