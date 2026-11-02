import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forgetSwipe,
  parseSwipeHistory,
  pruneSwipeHistory,
  recordSwipe,
  undoLastSwipe,
  type SwipeRecord,
} from "./swipe-history.ts";

const voteA: SwipeRecord = { id: "a", direction: "right", addedVote: true };
const skipB: SwipeRecord = { id: "b", direction: "left", addedVote: false };
const keepC: SwipeRecord = { id: "c", direction: "right", addedVote: false };

describe("recordSwipe", () => {
  it("appends the newest swipe last", () => {
    assert.deepEqual(recordSwipe(recordSwipe([], voteA), skipB), [voteA, skipB]);
  });

  it("replaces an older swipe of the same card", () => {
    const again: SwipeRecord = { id: "a", direction: "left", addedVote: false };
    assert.deepEqual(recordSwipe([voteA, skipB], again), [skipB, again]);
  });
});

describe("undoLastSwipe", () => {
  it("returns null when there is nothing to undo", () => {
    assert.equal(undoLastSwipe([]), null);
  });

  it("removes the vote only when the right swipe cast it", () => {
    assert.equal(undoLastSwipe([voteA])?.removeVote, true);
    assert.equal(undoLastSwipe([keepC])?.removeVote, false);
  });

  it("never sends a request for a left swipe", () => {
    assert.equal(undoLastSwipe([skipB])?.removeVote, false);
  });

  it("walks back through the history one swipe at a time", () => {
    const first = undoLastSwipe([voteA, skipB, keepC]);
    assert.equal(first?.record.id, "c");
    const second = undoLastSwipe(first!.history);
    assert.equal(second?.record.id, "b");
    const third = undoLastSwipe(second!.history);
    assert.equal(third?.record.id, "a");
    assert.deepEqual(third?.history, []);
  });
});

describe("forgetSwipe and pruneSwipeHistory", () => {
  it("forgets a card whose vote failed", () => {
    assert.deepEqual(forgetSwipe([voteA, skipB], "a"), [skipB]);
  });

  it("keeps the same history when nothing changes", () => {
    const history = [voteA, skipB];
    assert.equal(forgetSwipe(history, "z"), history);
    assert.equal(pruneSwipeHistory(history, new Set(["a", "b"])), history);
  });

  it("drops swipes of cards that are back on the deck or deleted", () => {
    assert.deepEqual(pruneSwipeHistory([voteA, skipB, keepC], new Set(["b"])), [skipB]);
  });
});

describe("parseSwipeHistory", () => {
  it("round-trips a stored history", () => {
    assert.deepEqual(parseSwipeHistory(JSON.stringify([voteA, skipB])), [voteA, skipB]);
  });

  it("drops malformed entries and bad JSON", () => {
    const raw = JSON.stringify([voteA, { id: "x", direction: "up", addedVote: true }, { id: 3 }, null]);
    assert.deepEqual(parseSwipeHistory(raw), [voteA]);
    assert.deepEqual(parseSwipeHistory("{not json"), []);
    assert.deepEqual(parseSwipeHistory(JSON.stringify({ id: "a" })), []);
    assert.deepEqual(parseSwipeHistory(null), []);
  });
});
