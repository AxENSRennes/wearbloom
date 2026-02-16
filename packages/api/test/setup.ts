import { afterAll, afterEach, beforeAll } from "bun:test";

// Set DATABASE_URL so @acme/db/client can connect
process.env.DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/wearbloom";

const TEST_USER_ID = "user-credit-test";

// Create test user before all tests, clean up after
beforeAll(async () => {
  const { db } = await import("@acme/db/client");
  const { users } = await import("@acme/db/schema");
  // Insert test user (ignore conflict if already exists)
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: "credit@example.com",
      name: "Credit User",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
});

// Clean up credit and subscription rows after each test
afterEach(async () => {
  const { db } = await import("@acme/db/client");
  const { eq } = await import("@acme/db");
  const { credits, subscriptions } = await import("@acme/db/schema");
  await db.delete(subscriptions).where(eq(subscriptions.userId, TEST_USER_ID));
  await db.delete(credits).where(eq(credits.userId, TEST_USER_ID));
});

// Remove test user after all tests
afterAll(async () => {
  const { db } = await import("@acme/db/client");
  const { eq } = await import("@acme/db");
  const { users } = await import("@acme/db/schema");
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
});
