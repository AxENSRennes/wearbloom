import { mock } from "bun:test";

// Mock @acme/db/client — drizzle client requires DATABASE_URL at import time
mock.module("@acme/db/client", () => ({
  db: {},
}));
