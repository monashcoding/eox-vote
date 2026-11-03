// Client-safe: shared by the attendee and host notices and by the server purge.

/** Days a nomination, with its photo and votes, is kept after it is submitted. */
export const NOMINATION_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nominations submitted before this instant are past retention and get deleted. */
export function nominationRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - NOMINATION_RETENTION_DAYS * DAY_MS);
}
