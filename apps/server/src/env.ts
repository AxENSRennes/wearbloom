import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";
import { TRYON_PROVIDERS } from "@acme/validators";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  BETTER_AUTH_BASE_URL: z.url().optional(),
  BETTER_AUTH_PRODUCTION_URL: z.url().optional(),
  IMAGES_DIR: z.string().default("/data/images"),
  REPLICATE_API_TOKEN: z.string().default(""),
  FAL_KEY: z.string().default(""),
  ACTIVE_TRYON_PROVIDER: z.enum(TRYON_PROVIDERS).default("fal_fashn"),
  FAL_WEBHOOK_URL: z.string().default(""),
  FAL_NANO_BANANA_MODEL_ID: z.string().default(""),
  GOOGLE_CLOUD_PROJECT: z.string().default(""),
  GOOGLE_CLOUD_REGION: z.string().default("us-central1"),
  GOOGLE_ACCESS_TOKEN: z.string().default(""),
  RENDER_TIMEOUT_MS: z.coerce.number().default(30000),
  ANONYMOUS_SESSION_TTL_HOURS: z.coerce.number().default(24),
  ANONYMOUS_MAX_RENDERS: z.coerce.number().default(1),
  FREE_CREDITS_COUNT: z.coerce.number().int().min(0).default(3),
  // Apple IAP — optional at startup, validated at point of use
  APPLE_IAP_KEY_ID: z.string().min(1).optional(),
  APPLE_IAP_ISSUER_ID: z.string().min(1).optional(),
  APPLE_IAP_KEY_PATH: z.string().min(1).optional(),
  APPLE_APP_ID: z.coerce.number().optional(),
});

const productionAuthSchema = z.object({
  BETTER_AUTH_BASE_URL: z.url(),
  BETTER_AUTH_PRODUCTION_URL: z.url(),
});

const authEnvVars = authEnv();
const parsedServerEnv = serverSchema.parse(process.env);

if (parsedServerEnv.NODE_ENV === "production") {
  productionAuthSchema.parse(parsedServerEnv);
}

export const env = {
  ...parsedServerEnv,
  ...authEnvVars,
};
