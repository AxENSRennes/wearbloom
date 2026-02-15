import { createId } from "@paralleldrive/cuid2";
import { pgEnum, pgTable } from "drizzle-orm/pg-core";

export const users = pgTable("users", (t) => ({
  id: t.text().primaryKey(),
  name: t.text(),
  email: t.text().notNull().unique(),
  emailVerified: t.boolean().default(false),
  image: t.text(),
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

export const verifications = pgTable("verifications", (t) => ({
  id: t.text().primaryKey(),
  identifier: t.text().notNull(),
  value: t.text().notNull(),
  expiresAt: t.timestamp().notNull(),
  createdAt: t.timestamp(),
  updatedAt: t.timestamp(),
}));

export const subscriptionStatus = pgEnum("subscription_status", [
  "trial",
  "subscribed",
  "expired",
  "cancelled",
]);

export const subscriptions = pgTable("subscriptions", (t) => ({
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
}));

export const credits = pgTable("credits", (t) => ({
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
}));
