import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forgetSwipe,
  parseSwipeHistory,
  pruneSwipeHistory,
  recordSwipe,
  undoLastSwipe,
  VoteChange,
  voteChangeFor,
  type SwipeRecord,
} from "./swipe-history.ts";

const voteA: SwipeRecord = { id: "a", categoryId: "dressed", direction: "right", voteChange: VoteChange.Added };
const skipB: SwipeRecord = { id: "b", categoryId: "dressed", direction: "left", voteChange: VoteChange.None };
const keepC: SwipeRecord = { id: "c", categoryId: "dressed", direction: "right", voteChange: VoteChange.None };
const unvoteD: SwipeRecord = { id: "d", categoryId: "dressed", direction: "left", voteChange: VoteChange.Removed };
/** The same nominee as `voteA`, in another category's deck. */
const voteAnimalA: SwipeRecord = { id: "a", categoryId: "animal", direction: "right", voteChange: VoteChange.Added };

describe("voteChangeFor", () => {
  it("adds a vote on a right swipe only when there is none", () => {
    assert.equal(voteChangeFor("right", false), VoteChange.Added);
    assert.equal(voteChangeFor("right", true), VoteChange.None);
  });

  it("removes the vote on a left swipe of a voted card", () => {
    assert.equal(voteChangeFor("left", true), VoteChange.Removed);
    assert.equal(voteChangeFor("left", false), VoteChange.None);
  });
});

describe("recordSwipe", () => {
  it("appends the newest swipe last", () => {
    assert.deepEqual(recordSwipe(recordSwipe([], voteA), skipB), [voteA, skipB]);
  });

  it("replaces an older swipe of the same card", () => {
    const again: SwipeRecord = { ...voteA, direction: "left", voteChange: VoteChange.Removed };
    assert.deepEqual(recordSwipe([voteA, skipB], again), [skipB, again]);
  });

  it("keeps the same nominee's swipe in another category", () => {
    assert.deepEqual(recordSwipe([voteA, skipB], voteAnimalA), [voteA, skipB, voteAnimalA]);
  });
});

describe("undoLastSwipe", () => {
  it("returns null when there is nothing to undo", () => {
    assert.equal(undoLastSwipe([]), null);
  });

  it("takes back a vote the swipe cast", () => {
    assert.equal(undoLastSwipe([voteA])?.restoreVote, false);
  });

  it("restores a vote the skip removed", () => {
    assert.equal(undoLastSwipe([unvoteD])?.restoreVote, true);
  });

  it("sends nothing when the swipe changed nothing", () => {
    assert.equal(undoLastSwipe([keepC])?.restoreVote, null);
    assert.equal(undoLastSwipe([skipB])?.restoreVote, null);
  });

  it("walks back through the history one swipe at a time, across categories", () => {
    const first = undoLastSwipe([voteA, skipB, voteAnimalA]);
    assert.deepEqual(first?.record, voteAnimalA);
    const second = undoLastSwipe(first!.history);
    assert.equal(second?.record.id, "b");
    const third = undoLastSwipe(second!.history);
    assert.deepEqual(third?.record, voteA);
    assert.deepEqual(third?.history, []);
  });
});

describe("forgetSwipe and pruneSwipeHistory", () => {
  it("forgets a card whose vote change failed, in its category only", () => {
    assert.deepEqual(forgetSwipe([voteA, skipB, voteAnimalA], "dressed", "a"), [skipB, voteAnimalA]);
  });

  it("keeps the same history when nothing changes", () => {
    const history = [voteA, skipB];
    assert.equal(forgetSwipe(history, "animal", "a"), history);
    assert.equal(pruneSwipeHistory(history, () => true), history);
  });

  it("drops swipes of cards that are back on the deck or deleted", () => {
    assert.deepEqual(
      pruneSwipeHistory([voteA, skipB, keepC, voteAnimalA], (r) => r.categoryId === "dressed" && r.id === "b"),
      [skipB]
    );
  });
});

describe("parseSwipeHistory", () => {
  it("round-trips a stored history", () => {
    assert.deepEqual(
      parseSwipeHistory(JSON.stringify([voteA, skipB, unvoteD, voteAnimalA])),
      [voteA, skipB, unvoteD, voteAnimalA]
    );
  });

  it("drops entries stored before categories", () => {
    const raw = JSON.stringify([
      { id: "a", direction: "right", voteChange: VoteChange.Added },
      { id: "b", direction: "left", addedVote: false },
      voteA,
    ]);
    assert.deepEqual(parseSwipeHistory(raw), [voteA]);
  });

  it("drops malformed entries and bad JSON", () => {
    const raw = JSON.stringify([
      voteA,
      { id: "x", categoryId: "dressed", direction: "up", voteChange: VoteChange.Added },
      { id: "y", categoryId: "dressed", direction: "left", voteChange: "maybe" },
      { id: "z", categoryId: 4, direction: "left", voteChange: VoteChange.None },
      { id: 3 },
      null,
    ]);
    assert.deepEqual(parseSwipeHistory(raw), [voteA]);
    assert.deepEqual(parseSwipeHistory("{not json"), []);
    assert.deepEqual(parseSwipeHistory(JSON.stringify({ id: "a" })), []);
    assert.deepEqual(parseSwipeHistory(null), []);
  });
});
