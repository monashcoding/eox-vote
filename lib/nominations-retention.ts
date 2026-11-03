import { lt } from "drizzle-orm";
import { db } from "./db";
import { nominees } from "./db/schema";
import { NOMINATION_RETENTION_DAYS, nominationRetentionCutoff } from "./retention";
import { invalidatePublicState } from "./session/public-state";

const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Deletes nominations submitted more than NOMINATION_RETENTION_DAYS ago. Their
 * photos and votes go with them (on delete cascade). Idempotent, so several
 * server instances running it at once is harmless. Returns the number deleted.
 */
export async function purgeExpiredNominations(now = new Date()): Promise<number> {
  const result = await db
    .delete(nominees)
    .where(lt(nominees.createdAt, nominationRetentionCutoff(now)));
  const deleted = result.rowCount ?? 0;
  if (deleted > 0) {
    invalidatePublicState();
  }
  return deleted;
}

async function runPurge(): Promise<void> {
  try {
    const deleted = await purgeExpiredNominations();
    console.info(
      `[retention] Deleted ${deleted} ${deleted === 1 ? "nomination" : "nominations"} older than ${NOMINATION_RETENTION_DAYS} days.`
    );
  } catch (err: unknown) {
    // A database blip must never crash the server; the next run tries again.
    console.error("[retention] Could not delete expired nominations:", err);
  }
}

// One schedule per process, even if register() runs again (dev reloads).
const globalForRetention = globalThis as unknown as {
  __nominationPurgeTimer?: NodeJS.Timeout;
};

/** Purges now, then hourly. The timer never keeps the process alive. */
export function scheduleNominationPurge(): void {
  if (globalForRetention.__nominationPurgeTimer) {
    return;
  }
  void runPurge();
  globalForRetention.__nominationPurgeTimer = setInterval(
    () => void runPurge(),
    PURGE_INTERVAL_MS
  ).unref();
}
