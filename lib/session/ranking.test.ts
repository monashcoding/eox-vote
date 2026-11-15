import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Stage } from "../api-types.ts";
import type { CategoryPodiumDto, PodiumPlaceDto } from "../api-types.ts";
import {
  buildCategoryPodiums,
  buildPodium,
  clampRevealed,
  publicResults,
  revealSteps,
  type CategoryRankableNominee,
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

describe("Ranking: buildCategoryPodiums", () => {
  function voter(id: string, votesByCategory: Record<string, number>): CategoryRankableNominee {
    const { firstName, lastName, photoUrl } = nominee(id, 0);
    return { id, firstName, lastName, photoUrl, votesByCategory };
  }

  it("ranks every nominee in every category on that category's votes", () => {
    const podiums = buildCategoryPodiums(
      [{ id: "dressed" }, { id: "animal" }],
      [voter("a", { dressed: 5, animal: 1 }), voter("b", { dressed: 1, animal: 4 })]
    );
    assert.deepEqual(
      podiums.map((p) => [p.categoryId, shape(p.places)]),
      [
        ["dressed", [[1, 5, ["a"]], [2, 1, ["b"]]]],
        ["animal", [[1, 4, ["b"]], [2, 1, ["a"]]]],
      ]
    );
  });

  it("keeps a category without votes, with an empty podium", () => {
    const podiums = buildCategoryPodiums(
      [{ id: "dressed" }, { id: "animal" }],
      [voter("a", { dressed: 2 })]
    );
    assert.deepEqual(podiums[1], { categoryId: "animal", places: [] });
  });
});

describe("Ranking: revealSteps", () => {
  it("goes category by category, each lowest place first", () => {
    const podiums: CategoryPodiumDto[] = [
      { categoryId: "dressed", places: buildPodium([nominee("a", 9), nominee("b", 5), nominee("c", 2)]) },
      { categoryId: "empty", places: [] },
      { categoryId: "animal", places: buildPodium([nominee("d", 3), nominee("e", 1)]) },
    ];
    assert.deepEqual(
      revealSteps(podiums).map((step) => [step.categoryId, step.place.place]),
      [
        ["dressed", 3],
        ["dressed", 2],
        ["dressed", 1],
        ["animal", 2],
        ["animal", 1],
      ]
    );
  });
});

describe("Ranking: publicResults", () => {
  const podiums: CategoryPodiumDto[] = [
    { categoryId: "dressed", places: buildPodium([nominee("a", 9), nominee("b", 5), nominee("c", 2)]) },
    { categoryId: "animal", places: buildPodium([nominee("d", 3), nominee("e", 1)]) },
  ];
  /** `[categoryId, totalSteps, revealed places]` per category. */
  const view = (stage: Stage, revealed: number) =>
    publicResults(stage, podiums, revealed)?.categories.map((c) => [
      c.categoryId,
      c.totalSteps,
      c.revealed.map((g) => g.place),
    ]);

  it("is null outside results and finished", () => {
    for (const stage of [Stage.Pending, Stage.Nominating, Stage.Voting]) {
      assert.equal(publicResults(stage, podiums, 3), null);
    }
  });

  it("shows nothing before the first reveal but reports each category's total", () => {
    assert.deepEqual(view(Stage.Results, 0), [
      ["dressed", 3, []],
      ["animal", 2, []],
    ]);
  });

  it("reveals the first category lowest place first, then the next", () => {
    assert.deepEqual(view(Stage.Results, 2), [
      ["dressed", 3, [3, 2]],
      ["animal", 2, []],
    ]);
    assert.deepEqual(view(Stage.Results, 4), [
      ["dressed", 3, [3, 2, 1]],
      ["animal", 2, [2]],
    ]);
  });

  it("caps a stale counter at the number of steps", () => {
    assert.deepEqual(view(Stage.Results, 99), [
      ["dressed", 3, [3, 2, 1]],
      ["animal", 2, [2, 1]],
    ]);
  });

  it("shows every step when finished regardless of the counter", () => {
    assert.deepEqual(view(Stage.Finished, 0), [
      ["dressed", 3, [3, 2, 1]],
      ["animal", 2, [2, 1]],
    ]);
  });

  it("reports zero steps for a category nobody voted in", () => {
    assert.deepEqual(
      publicResults(Stage.Results, [{ categoryId: "dressed", places: [] }], 0),
      { categories: [{ categoryId: "dressed", totalSteps: 0, revealed: [] }] }
    );
  });
});
