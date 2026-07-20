import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  ROLE: z.enum(["api", "worker"]).default("api"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_ROOT: z.string().default("./data/private"),
  PUBLIC_APP_URL: z.string().url().default("https://wearbloom.app"),
  AI_PROVIDER: z.enum(["openai", "stub"]).default("stub"),
  OPENAI_API_KEY: z.string().optional(),
  IMAGE_MODEL: z.string().default("gpt-image-1"),
  IMAGE_SIZE: z.string().default("1024x1536"),
  PROMPT_VERSION: z.string().default("wearbloom-v1"),
  FREE_RENDER_ALLOWANCE: z.coerce.number().int().nonnegative().default(2),
  PAID_MONTHLY_ALLOWANCE: z.coerce.number().int().positive().default(20),
  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().default("com.axel.wearbloom"),
  APP_ATTEST_REQUIRED: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  APP_ATTEST_ALLOW_DEVELOPMENT: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration: ${parsed.error.message}`);
  }
  if (parsed.data.AI_PROVIDER === "openai" && !parsed.data.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
  }
  return {
    ...parsed.data,
    APP_ATTEST_REQUIRED: environment.APP_ATTEST_REQUIRED === undefined && parsed.data.NODE_ENV === "production"
      ? true
      : parsed.data.APP_ATTEST_REQUIRED,
  };
}
