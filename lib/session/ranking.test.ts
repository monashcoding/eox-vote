import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Stage } from "../api-types.ts";
import type { PodiumPlaceDto } from "../api-types.ts";
import {
  buildPodium,
  clampRevealed,
  publicResults,
  type RankableNominee,
} from "./ranking.ts";

function nominee(id: string, votes: number): RankableNominee {
  return {
    id,
    firstName: id.toUpperCase(),
    lastName: "Tester",
    photoUrl: `/api/photos/${id}?v=1`,
    votes,
  };
}

/** Compact view of a podium: `[place, votes, ids]` per group. */
function shape(podium: PodiumPlaceDto[]) {
  return podium.map((g) => [g.place, g.votes, g.nominees.map((n) => n.id)]);
}

describe("Ranking: buildPodium", () => {
  it("returns an empty podium when nobody has votes", () => {
    assert.deepEqual(buildPodium([]), []);
    assert.deepEqual(buildPodium([nominee("a", 0), nominee("b", 0)]), []);
  });

  it("ignores nominees with zero votes", () => {
    const podium = buildPodium([nominee("a", 0), nominee("b", 2), nominee("c", 0)]);
    assert.deepEqual(shape(podium), [[1, 2, ["b"]]]);
  });

  it("ranks distinct vote counts 1, 2, 3 and drops lower places", () => {
    const podium = buildPodium([
      nominee("d", 1),
      nominee("b", 5),
      nominee("a", 9),
      nominee("c", 3),
    ]);
    assert.deepEqual(shape(podium), [
      [1, 9, ["a"]],
      [2, 5, ["b"]],
      [3, 3, ["c"]],
    ]);
  });

  it("handles fewer than three entries", () => {
    assert.deepEqual(shape(buildPodium([nominee("a", 4)])), [[1, 4, ["a"]]]);
    assert.deepEqual(shape(buildPodium([nominee("a", 4), nominee("b", 1)])), [
      [1, 4, ["a"]],
      [2, 1, ["b"]],
    ]);
  });

  it("groups a tie for first and skips place 2 (1, 1, 3)", () => {
    const podium = buildPodium([nominee("a", 5), nominee("b", 5), nominee("c", 2)]);
    assert.deepEqual(shape(podium), [
      [1, 5, ["a", "b"]],
      [3, 2, ["c"]],
    ]);
  });

  it("groups a tie for second and skips place 3 (1, 2, 2, 4)", () => {
    const podium = buildPodium([
      nominee("a", 9),
      nominee("b", 5),
      nominee("c", 5),
      nominee("d", 1),
    ]);
    assert.deepEqual(shape(podium), [
      [1, 9, ["a"]],
      [2, 5, ["b", "c"]],
    ]);
  });

  it("groups a three-way tie for first as the only place", () => {
    const podium = buildPodium([
      nominee("a", 4),
      nominee("b", 4),
      nominee("c", 4),
      nominee("d", 1),
    ]);
    assert.deepEqual(shape(podium), [[1, 4, ["a", "b", "c"]]]);
  });

  it("groups four tied for third into one place 3", () => {
    const podium = buildPodium([
      nominee("a", 9),
      nominee("b", 7),
      nominee("c", 2),
      nominee("d", 2),
      nominee("e", 2),
      nominee("f", 2),
      nominee("g", 1),
    ]);
    assert.deepEqual(shape(podium), [
      [1, 9, ["a"]],
      [2, 7, ["b"]],
      [3, 2, ["c", "d", "e", "f"]],
    ]);
  });

  it("drops everyone below a tie that pushes the next place past 3", () => {
    const podium = buildPodium([
      nominee("a", 3),
      nominee("b", 3),
      nominee("c", 3),
      nominee("d", 2),
    ]);
    assert.deepEqual(shape(podium), [[1, 3, ["a", "b", "c"]]]);
  });

  it("keeps input order within a tie and does not mutate the input", () => {
    const input = [nominee("x", 1), nominee("y", 2), nominee("z", 2)];
    const snapshot = structuredClone(input);
    assert.deepEqual(shape(buildPodium(input)), [
      [1, 2, ["y", "z"]],
      [3, 1, ["x"]],
    ]);
    assert.deepEqual(input, snapshot);
  });

  it("only exposes public nominee fields", () => {
    const [group] = buildPodium([nominee("a", 1)]);
    assert.deepEqual(Object.keys(group.nominees[0]).sort(), [
      "firstName",
      "id",
      "lastName",
      "photoUrl",
    ]);
  });
});

describe("Ranking: clampRevealed", () => {
  it("clamps the revealed counter into 0..total", () => {
    assert.equal(clampRevealed(-1, 3), 0);
    assert.equal(clampRevealed(2, 3), 2);
    assert.equal(clampRevealed(9, 3), 3);
    assert.equal(clampRevealed(1, 0), 0);
  });
});

describe("Ranking: publicResults", () => {
  const podium = buildPodium([nominee("a", 9), nominee("b", 5), nominee("c", 2)]);

  it("is null outside results and finished", () => {
    for (const stage of [Stage.Pending, Stage.Nominating, Stage.Voting]) {
      assert.equal(publicResults(stage, podium, 3), null);
    }
  });

  it("shows nothing before the first reveal but reports the total", () => {
    assert.deepEqual(publicResults(Stage.Results, podium, 0), {
      totalSteps: 3,
      revealed: [],
    });
  });

  it("shows only the first revealedCount steps, lowest place first", () => {
    const one = publicResults(Stage.Results, podium, 1);
    assert.deepEqual(one?.revealed.map((g) => g.place), [3]);
    const two = publicResults(Stage.Results, podium, 2);
    assert.deepEqual(two?.revealed.map((g) => g.place), [3, 2]);
    assert.equal(two?.totalSteps, 3);
  });

  it("caps a stale counter at the number of steps", () => {
    assert.equal(publicResults(Stage.Results, podium, 99)?.revealed.length, 3);
  });

  it("shows every step when finished regardless of the counter", () => {
    const result = publicResults(Stage.Finished, podium, 0);
    assert.deepEqual(result?.revealed.map((g) => g.place), [3, 2, 1]);
  });

  it("reports zero steps when nobody has votes", () => {
    assert.deepEqual(publicResults(Stage.Results, [], 0), {
      totalSteps: 0,
      revealed: [],
    });
    assert.deepEqual(publicResults(Stage.Finished, [], 0), {
      totalSteps: 0,
      revealed: [],
    });
  });
});
