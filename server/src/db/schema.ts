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
import type { RenderInputSnapshot, RenderResponse } from "../domain/render-contract";
import { GARMENT_CATEGORIES } from "../domain/categories";
import { user } from "./auth-schema";

export { account, session, user, verification } from "./auth-schema";

export const garmentCategory = pgEnum("garment_category", GARMENT_CATEGORIES);
export const renderStatus = pgEnum("render_status", ["queued", "processing", "succeeded", "failed", "cancelled"]);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteCount: integer("byte_count").notNull(),
    width: integer("width"),
    height: integer("height"),
    sha256: text("sha256").notNull(),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("assets_owner_idx").on(table.ownerId)],
);

export const garments = pgTable(
  "garments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: garmentCategory("category").notNull(),
    originalAssetId: uuid("original_asset_id").references(() => assets.id, { onDelete: "set null" }),
    cleanedAssetId: uuid("cleaned_asset_id").references(() => assets.id, { onDelete: "set null" }),
    detection: jsonb("detection").$type<{ category: string; confidence: number; model: string }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("garments_owner_idx").on(table.ownerId)],
);

export const referencePhotos = pgTable(
  "reference_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    generatedFromVariantId: uuid("generated_from_variant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reference_photos_owner_idx").on(table.ownerId)],
);

export const looks = pgTable(
  "looks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("looks_owner_idx").on(table.ownerId)],
);

export const lookGarments = pgTable(
  "look_garments",
  {
    lookId: uuid("look_id")
      .notNull()
      .references(() => looks.id, { onDelete: "cascade" }),
    garmentId: uuid("garment_id")
      .notNull()
      .references(() => garments.id, { onDelete: "restrict" }),
    category: garmentCategory("category").notNull(),
  },
  (table) => [
    uniqueIndex("look_one_garment_per_category").on(table.lookId, table.category),
    index("look_garments_look_idx").on(table.lookId),
  ],
);

export const renderVariants = pgTable(
  "render_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lookId: uuid("look_id")
      .notNull()
      .references(() => looks.id, { onDelete: "cascade" }),
    referencePhotoId: uuid("reference_photo_id").references(() => referencePhotos.id, { onDelete: "set null" }),
    resultAssetId: uuid("result_asset_id").references(() => assets.id, { onDelete: "set null" }),
    status: renderStatus("status").notNull().default("queued"),
    inputSnapshot: jsonb("input_snapshot").$type<RenderInputSnapshot>().notNull(),
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
  },
  (table) => [index("render_queue_idx").on(table.status, table.createdAt), index("render_owner_idx").on(table.ownerId)],
);

export const quotaLedger = pgTable(
  "quota_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    renderVariantId: uuid("render_variant_id").references(() => renderVariants.id, { onDelete: "set null" }),
    units: integer("units").notNull(),
    reason: text("reason").notNull(),
    periodKey: text("period_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("quota_once_per_render_reason").on(table.renderVariantId, table.reason),
    index("quota_owner_period_idx").on(table.ownerId, table.periodKey),
  ],
);

export const entitlements = pgTable("entitlements", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  appleAppAccountToken: uuid("apple_app_account_token").notNull().defaultRandom().unique(),
  originalTransactionId: text("original_transaction_id").unique(),
  latestTransactionId: text("latest_transaction_id"),
  productId: text("product_id"),
  status: text("status").notNull().default("inactive"),
  isPro: boolean("is_pro").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  willRenew: boolean("will_renew").notNull().default(false),
  environment: text("environment"),
  lastAppleSignedAt: timestamp("last_apple_signed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appleSubscriptionNotifications = pgTable(
  "apple_subscription_notifications",
  {
    notificationUuid: uuid("notification_uuid").primaryKey(),
    notificationType: text("notification_type").notNull(),
    subtype: text("subtype"),
    environment: text("environment"),
    originalTransactionId: text("original_transaction_id"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("apple_subscription_notifications_transaction_idx").on(table.originalTransactionId),
    index("apple_subscription_notifications_received_idx").on(table.receivedAt),
  ],
);

export const cleanupJobs = pgTable(
  "cleanup_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageKey: text("storage_key").notNull().unique(),
    attemptCount: integer("attempt_count").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cleanup_pending_idx").on(table.completedAt, table.createdAt)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<RenderResponse>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idempotency_owner_key").on(table.ownerId, table.key)],
);

export const appAttestChallenges = pgTable(
  "app_attest_challenges",
  {
    challenge: text("challenge").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("app_attest_challenge_owner_idx").on(table.ownerId)],
);

export const appAttestKeys = pgTable(
  "app_attest_keys",
  {
    keyId: text("key_id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    signCount: integer("sign_count").notNull().default(0),
    environment: text("environment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("app_attest_key_owner_idx").on(table.ownerId)],
);

export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [
    uniqueIndex("rate_limit_owner_action_window").on(table.ownerId, table.action, table.windowStart),
    index("rate_limit_window_cleanup_idx").on(table.windowStart),
  ],
);

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  version: text("version").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const privacyPreferences = pgTable("privacy_preferences", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  analyticsEnabled: boolean("analytics_enabled").notNull().default(false),
  diagnosticsEnabled: boolean("diagnostics_enabled").notNull().default(false),
  consentVersion: integer("consent_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deviceTokens = pgTable(
  "device_tokens",
  {
    token: text("token").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    environment: text("environment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("device_tokens_owner_idx").on(table.ownerId)],
);
