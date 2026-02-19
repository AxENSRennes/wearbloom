import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, unique } from "drizzle-orm/pg-core";

import { GARMENT_CATEGORIES, TRYON_PROVIDERS } from "@acme/validators";

export { GARMENT_CATEGORIES, TRYON_PROVIDERS };

export const users = pgTable("users", (t) => ({
  id: t.text().primaryKey(),
  name: t.text(),
  email: t.text().notNull().unique(),
  emailVerified: t.boolean().default(false),
  image: t.text(),
  isAnonymous: t.boolean().default(false),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().notNull(),
}));

export const sessions = pgTable("sessions", (t) => ({
  id: t.text().primaryKey(),
  expiresAt: t.timestamp().notNull(),
  token: t.text().notNull().unique(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().notNull(),
  ipAddress: t.text(),
  userAgent: t.text(),
  userId: t
    .text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
}));

export const accounts = pgTable("accounts", (t) => ({
  id: t.text().primaryKey(),
  accountId: t.text().notNull(),
  providerId: t.text().notNull(),
  userId: t
    .text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: t.text(),
  refreshToken: t.text(),
  idToken: t.text(),
  accessTokenExpiresAt: t.timestamp(),
  refreshTokenExpiresAt: t.timestamp(),
  scope: t.text(),
  password: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().notNull(),
}));

export const bodyPhotos = pgTable(
  "body_photos",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filePath: t.text().notNull(),
    mimeType: t.text().notNull(),
    width: t.integer(),
    height: t.integer(),
    fileSize: t.integer(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => [unique().on(table.userId)],
);

export const garmentCategory = pgEnum("garment_category", GARMENT_CATEGORIES);

export const BG_REMOVAL_STATUSES = [
  "pending",
  "completed",
  "failed",
  "skipped",
] as const;

export const bgRemovalStatusEnum = pgEnum(
  "bg_removal_status",
  BG_REMOVAL_STATUSES,
);

export const garments = pgTable(
  "garments",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: garmentCategory().notNull(),
    imagePath: t.text().notNull(),
    cutoutPath: t.text(),
    bgRemovalStatus: bgRemovalStatusEnum().default("pending").notNull(),
    mimeType: t.text().notNull(),
    width: t.integer(),
    height: t.integer(),
    fileSize: t.integer(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => [index("garments_user_id_idx").on(table.userId)],
);

export const RENDER_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export const renderStatus = pgEnum("render_status", RENDER_STATUSES);
export const tryOnProviderEnum = pgEnum("try_on_provider", TRYON_PROVIDERS);

export const tryOnRenders = pgTable(
  "try_on_renders",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    garmentId: t
      .text()
      .notNull()
      .references(() => garments.id, { onDelete: "cascade" }),
    provider: tryOnProviderEnum().notNull(),
    status: renderStatus().notNull().default("pending"),
    jobId: t.text(),
    resultPath: t.text(),
    errorCode: t.text(),
    creditConsumed: t.boolean().notNull().default(false),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
      .timestamp()
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  }),
  (table) => [
    index("try_on_renders_job_id_idx").on(table.jobId),
    index("try_on_renders_user_id_idx").on(table.userId),
    index("try_on_renders_garment_id_idx").on(table.garmentId),
  ],
);

export const FEEDBACK_RATINGS = ["thumbs_up", "thumbs_down"] as const;

export const feedbackRating = pgEnum("feedback_rating", FEEDBACK_RATINGS);

export const renderFeedback = pgTable(
  "render_feedback",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    renderId: t
      .text()
      .notNull()
      .references(() => tryOnRenders.id, { onDelete: "cascade" })
      .unique(),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: feedbackRating().notNull(),
    category: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => [index("render_feedback_user_id_idx").on(table.userId)],
);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trial",
  "subscribed",
  "expired",
  "cancelled",
  "grace_period",
]);

export const subscriptions = pgTable(
  "subscriptions",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    appleTransactionId: t.text(),
    appleOriginalTransactionId: t.text(),
    productId: t.text(),
    status: subscriptionStatus().notNull().default("trial"),
    startedAt: t.timestamp({ withTimezone: true }),
    expiresAt: t.timestamp({ withTimezone: true }),
    createdAt: t.timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    index("subscriptions_apple_orig_txn_idx").on(
      table.appleOriginalTransactionId,
    ),
  ],
);

export const credits = pgTable(
  "credits",
  (t) => ({
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: t
      .text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    totalGranted: t.integer().notNull().default(0),
    totalConsumed: t.integer().notNull().default(0),
    createdAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: t
      .timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    check(
      "credits_consumed_check",
      sql`${table.totalConsumed} >= 0 AND ${table.totalConsumed} <= ${table.totalGranted}`,
    ),
  ],
);

export const verifications = pgTable("verifications", (t) => ({
  id: t.text().primaryKey(),
  identifier: t.text().notNull(),
  value: t.text().notNull(),
  expiresAt: t.timestamp().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t.timestamp().notNull().defaultNow(),
}));
