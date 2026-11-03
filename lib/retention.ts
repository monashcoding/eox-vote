// Client-safe: shared by the attendee and host notices and by the server purge.

/** Days a nomination, with its photo and votes, is kept after it is submitted. */
export const NOMINATION_RETENTION_DAYS = 30;

/** Shown to attendees in the nominate form and the voting "All" tab. */
export const ATTENDEE_RETENTION_NOTICE = `Names, photos and votes are deleted after ${NOMINATION_RETENTION_DAYS} days.`;

/** Shown to hosts in the Nominees panel and on the sessions list. */
export const HOST_RETENTION_NOTICE = `Nominations, their photos and votes are deleted automatically ${NOMINATION_RETENTION_DAYS} days after each nomination is submitted.`;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nominations submitted before this instant are past retention and get deleted. */
export function nominationRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - NOMINATION_RETENTION_DAYS * DAY_MS);
}
