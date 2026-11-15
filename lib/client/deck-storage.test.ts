import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSwipedByCategory, shuffleBySeed } from "./deck-storage.ts";

const ITEMS = ["a1", "b2", "c3", "d4"].map((id) => ({ id }));
const ids = (items: readonly { id: string }[]) => items.map((i) => i.id).join(",");

describe("shuffleBySeed", () => {
  it("returns the same order for the same seed", () => {
    for (const seed of ["seed-1", "hy3ymc5m0yomvz6l32f", ""]) {
      assert.equal(ids(shuffleBySeed(ITEMS, seed)), ids(shuffleBySeed(ITEMS, seed)));
    }
  });

  it("does not depend on the input order", () => {
    const reversed = [...ITEMS].reverse();
    assert.equal(ids(shuffleBySeed(reversed, "seed-2")), ids(shuffleBySeed(ITEMS, "seed-2")));
  });

  it("keeps every item exactly once", () => {
    const out = shuffleBySeed(ITEMS, "seed-3");
    assert.deepEqual(ids([...out].sort((a, b) => a.id.localeCompare(b.id))), ids(ITEMS));
  });

  it("spreads orders roughly evenly across seeds", () => {
    const runs = 24_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i++) {
      const order = ids(shuffleBySeed(ITEMS, `${i.toString(36)}:${(i * 7919).toString(36)}`));
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }
    // 4 items: 24 orders, about 1000 each. Allow +-20%.
    assert.equal(counts.size, 24);
    for (const [order, count] of counts) {
      assert.ok(count > 800 && count < 1200, `${order} came up ${count} times`);
    }
  });
});

describe("parseSwipedByCategory", () => {
  it("round-trips the swiped cards of each category", () => {
    const decks = { dressed: ["a", "b"], animal: ["b"] };
    assert.deepEqual(parseSwipedByCategory(JSON.stringify(decks)), decks);
  });

  it("drops malformed entries and ids", () => {
    const raw = JSON.stringify({ dressed: ["a", 3, null, "b"], animal: "b", other: null });
    assert.deepEqual(parseSwipedByCategory(raw), { dressed: ["a", "b"] });
  });

  it("ignores the single list stored before categories, and bad JSON", () => {
    assert.deepEqual(parseSwipedByCategory(JSON.stringify(["a", "b"])), {});
    assert.deepEqual(parseSwipedByCategory("{not json"), {});
    assert.deepEqual(parseSwipedByCategory(null), {});
  });
});
