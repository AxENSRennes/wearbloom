import type { db as DbType } from "@acme/db/client";
import { and, eq, lt } from "@acme/db";
import { users } from "@acme/db/schema";

interface CleanupLogger {
  info: (obj: unknown, msg: string) => void;
  error: (obj: unknown, msg: string) => void;
}

interface CleanupDeps {
  db: typeof DbType;
  logger: CleanupLogger;
}

export function createAnonymousCleanupService(deps: CleanupDeps) {
  return {
    async cleanupExpiredAnonymousUsers(ttlHours: number): Promise<number> {
      const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

      const deleted = await deps.db
        .delete(users)
        .where(and(eq(users.isAnonymous, true), lt(users.createdAt, cutoff)))
        .returning({ id: users.id });

      deps.logger.info(
        { deletedCount: deleted.length, ttlHours, cutoff: cutoff.toISOString() },
        "Anonymous user cleanup completed",
      );

      return deleted.length;
    },
  };
}
