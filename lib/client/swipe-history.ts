import type { SwipeDirection } from "./swipe-decision.ts";

/** One swipe on the deck. The history keeps them oldest first. */
export interface SwipeRecord {
  id: string;
  direction: SwipeDirection;
  /**
   * True when this swipe cast the vote, i.e. it did not exist before. Only
   * then does undoing it remove the vote again.
   */
  addedVote: boolean;
}

export type SwipeHistory = readonly SwipeRecord[];

/** What undoing the last swipe changes. */
export interface UndoStep {
  record: SwipeRecord;
  /** The history without that swipe. */
  history: SwipeHistory;
  /** Send DELETE for `record.id`: the swipe cast a vote that undo takes back. */
  removeVote: boolean;
}

/** Adds a swipe as the newest entry, replacing any older swipe of the same card. */
export function recordSwipe(
  history: SwipeHistory,
  record: SwipeRecord
): SwipeHistory {
  return [...history.filter((entry) => entry.id !== record.id), record];
}

/** Drops a card's swipe, e.g. when its vote failed and the card went back on the deck. */
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
    removeVote: record.direction === "right" && record.addedVote,
  };
}

function isSwipeRecord(value: unknown): value is SwipeRecord {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    (entry.direction === "left" || entry.direction === "right") &&
    typeof entry.addedVote === "boolean"
  );
}

/** Reads a stored history, dropping anything malformed. */
export function parseSwipeHistory(raw: string | null): SwipeRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSwipeRecord) : [];
  } catch {
    return [];
  }
}
