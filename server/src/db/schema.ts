import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const garmentCategory = pgEnum("garment_category", ["top", "bottom", "dress", "outerwear"]);
export const renderStatus = pgEnum("render_status", ["queued", "processing", "succeeded", "failed", "cancelled"]);

// Better Auth core schema plus the anonymous plugin field.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_id_idx").on(table.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("account_user_id_idx").on(table.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  byteCount: integer("byte_count").notNull(),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [index("assets_owner_idx").on(table.ownerId)]);

export const garments = pgTable("garments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: garmentCategory("category").notNull(),
  originalAssetId: uuid("original_asset_id").references(() => assets.id, { onDelete: "set null" }),
  cleanedAssetId: uuid("cleaned_asset_id").references(() => assets.id, { onDelete: "set null" }),
  detection: jsonb("detection").$type<{ category: string; confidence: number; model: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("garments_owner_idx").on(table.ownerId)]);

export const referencePhotos = pgTable("reference_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").notNull().default(false),
  generatedFromVariantId: uuid("generated_from_variant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("reference_photos_owner_idx").on(table.ownerId)]);

export const looks = pgTable("looks", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [index("looks_owner_idx").on(table.ownerId)]);

export const lookGarments = pgTable("look_garments", {
  lookId: uuid("look_id").notNull().references(() => looks.id, { onDelete: "cascade" }),
  garmentId: uuid("garment_id").notNull().references(() => garments.id, { onDelete: "restrict" }),
  category: garmentCategory("category").notNull(),
}, (table) => [
  uniqueIndex("look_one_garment_per_category").on(table.lookId, table.category),
  index("look_garments_look_idx").on(table.lookId),
]);

export const renderVariants = pgTable("render_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  lookId: uuid("look_id").notNull().references(() => looks.id, { onDelete: "cascade" }),
  referencePhotoId: uuid("reference_photo_id").notNull().references(() => referencePhotos.id, { onDelete: "restrict" }),
  resultAssetId: uuid("result_asset_id").references(() => assets.id, { onDelete: "set null" }),
  status: renderStatus("status").notNull().default("queued"),
  inputSnapshot: jsonb("input_snapshot").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  errorCode: text("error_code"),
  providerRequestId: text("provider_request_id"),
  costMicros: integer("cost_micros"),
  looksLikeMe: boolean("looks_like_me"),
  helpful: boolean("helpful"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [index("render_queue_idx").on(table.status, table.createdAt), index("render_owner_idx").on(table.ownerId)]);

export const quotaLedger = pgTable("quota_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  renderVariantId: uuid("render_variant_id").notNull().references(() => renderVariants.id, { onDelete: "cascade" }),
  units: integer("units").notNull(),
  reason: text("reason").notNull(),
  periodKey: text("period_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("quota_once_per_render_reason").on(table.renderVariantId, table.reason), index("quota_owner_period_idx").on(table.ownerId, table.periodKey)]);

export const entitlements = pgTable("entitlements", {
  ownerId: text("owner_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  revenueCatAppUserId: text("revenuecat_app_user_id").notNull().unique(),
  productId: text("product_id"),
  isPro: boolean("is_pro").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cleanupJobs = pgTable("cleanup_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageKey: text("storage_key").notNull().unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("cleanup_pending_idx").on(table.completedAt, table.createdAt)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  operation: text("operation").notNull(),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("idempotency_owner_key").on(table.ownerId, table.key)]);

export const appAttestChallenges = pgTable("app_attest_challenges", {
  challenge: text("challenge").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("app_attest_challenge_owner_idx").on(table.ownerId)]);

export const appAttestKeys = pgTable("app_attest_keys", {
  keyId: text("key_id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  environment: text("environment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("app_attest_key_owner_idx").on(table.ownerId)]);

export const rateLimitWindows = pgTable("rate_limit_windows", {
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
}, (table) => [
  uniqueIndex("rate_limit_owner_action_window").on(table.ownerId, table.action, table.windowStart),
  index("rate_limit_window_cleanup_idx").on(table.windowStart),
]);

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  version: text("version").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});
