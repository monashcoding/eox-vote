import type { SwipeDirection } from "./swipe-decision.ts";

/** How one swipe changed this device's vote for the card. */
export const VoteChange = {
  /** Right swipe on a card without a vote: cast one. */
  Added: "added",
  /** Left swipe on a card with a vote: take it back. */
  Removed: "removed",
  /** The vote already matched the swipe, so nothing was sent. */
  None: "none",
} as const;

export type VoteChange = (typeof VoteChange)[keyof typeof VoteChange];

/** One swipe on the deck. The history keeps them oldest first. */
export interface SwipeRecord {
  id: string;
  direction: SwipeDirection;
  voteChange: VoteChange;
}

export type SwipeHistory = readonly SwipeRecord[];

/** What undoing the last swipe changes. */
export interface UndoStep {
  record: SwipeRecord;
  /** The history without that swipe. */
  history: SwipeHistory;
  /**
   * The vote to restore for `record.id`, or null when the swipe changed
   * nothing and undo sends no request.
   */
  restoreVote: boolean | null;
}

/** The vote change a swipe makes, given whether the card already has a vote. */
export function voteChangeFor(
  direction: SwipeDirection,
  hasVote: boolean
): VoteChange {
  if (direction === "right" && !hasVote) return VoteChange.Added;
  if (direction === "left" && hasVote) return VoteChange.Removed;
  return VoteChange.None;
}

/** Adds a swipe as the newest entry, replacing any older swipe of the same card. */
export function recordSwipe(
  history: SwipeHistory,
  record: SwipeRecord
): SwipeHistory {
  return [...history.filter((entry) => entry.id !== record.id), record];
}

/** Drops a card's swipe, e.g. when its vote change failed and the card went back on the deck. */
export function forgetSwipe(history: SwipeHistory, id: string): SwipeHistory {
  return history.some((entry) => entry.id === id)
    ? history.filter((entry) => entry.id !== id)
    : history;
}

/** Keeps only swipes of cards that are still swiped away and still exist. */
export function pruneSwipeHistory(
  history: SwipeHistory,
  swipedIds: ReadonlySet<string>
): SwipeHistory {
  return history.every((entry) => swipedIds.has(entry.id))
    ? history
    : history.filter((entry) => swipedIds.has(entry.id));
}

/** Takes back the newest swipe, or null when there is nothing to undo. */
export function undoLastSwipe(history: SwipeHistory): UndoStep | null {
  const record = history.at(-1);
  if (!record) return null;
  return {
    record,
    history: history.slice(0, -1),
    restoreVote:
      record.voteChange === VoteChange.Added
        ? false
        : record.voteChange === VoteChange.Removed
          ? true
          : null,
  };
}

function isVoteChange(value: unknown): value is VoteChange {
  return (Object.values(VoteChange) as unknown[]).includes(value);
}

/**
 * Reads one stored entry. Entries saved before skips could remove votes carry
 * `addedVote: boolean` instead of `voteChange`.
 */
function toSwipeRecord(value: unknown): SwipeRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string") return null;
  if (entry.direction !== "left" && entry.direction !== "right") return null;
  if (isVoteChange(entry.voteChange)) {
    return {
      id: entry.id,
      direction: entry.direction,
      voteChange: entry.voteChange,
    };
  }
  if (typeof entry.addedVote === "boolean") {
    return {
      id: entry.id,
      direction: entry.direction,
      voteChange: entry.addedVote ? VoteChange.Added : VoteChange.None,
    };
  }
  return null;
}

/** Reads a stored history, dropping anything malformed. */
export function parseSwipeHistory(raw: string | null): SwipeRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(toSwipeRecord)
      .filter((record): record is SwipeRecord => record !== null);
  } catch {
    return [];
  }
}
