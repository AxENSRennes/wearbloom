import { z } from "zod/v4";

import { authEnv } from "@acme/auth/env";

const serverSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  IMAGES_DIR: z.string().default("/data/images"),
  REPLICATE_API_TOKEN: z.string().default(""),
  FAL_KEY: z.string().default(""),
  ACTIVE_TRYON_PROVIDER: z
    .enum(["fal_fashn", "fal_nano_banana", "google_vto"])
    .default("fal_fashn"),
  FAL_WEBHOOK_URL: z.string().default(""),
  FAL_NANO_BANANA_MODEL_ID: z.string().default(""),
  GOOGLE_CLOUD_PROJECT: z.string().default(""),
  GOOGLE_CLOUD_REGION: z.string().default("us-central1"),
  RENDER_TIMEOUT_MS: z.coerce.number().default(30000),
});

const authEnvVars = authEnv();

export const env = {
  ...serverSchema.parse(process.env),
  ...authEnvVars,
};
