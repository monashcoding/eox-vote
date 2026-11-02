/** Most nominations one device may have in a session. */
export const MAX_NOMINATIONS_PER_DEVICE = 5;
/** Most nominations a session may hold in total. */
export const MAX_NOMINATIONS_PER_SESSION = 300;

/**
 * Returns the message to show when one more nomination would pass a cap,
 * given the counts that already exist, or null when it is allowed.
 */
export function nominationLimitError(
  deviceCount: number,
  sessionCount: number
): string | null {
  if (deviceCount >= MAX_NOMINATIONS_PER_DEVICE) {
    return `You can nominate up to ${MAX_NOMINATIONS_PER_DEVICE} people. Delete one of yours to nominate someone else.`;
  }
  if (sessionCount >= MAX_NOMINATIONS_PER_SESSION) {
    return `This session already has ${MAX_NOMINATIONS_PER_SESSION} nominations, the most it can take.`;
  }
  return null;
}
