import { createId } from "@paralleldrive/cuid2";
import { pgEnum, pgTable, unique } from "drizzle-orm/pg-core";

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

export const garmentCategory = pgEnum("garment_category", [
  "tops",
  "bottoms",
  "dresses",
  "shoes",
  "outerwear",
]);

export const garments = pgTable("garments", (t) => ({
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
  bgRemovalStatus: t.text().default("pending").notNull(),
  mimeType: t.text().notNull(),
  width: t.integer(),
  height: t.integer(),
  fileSize: t.integer(),
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
