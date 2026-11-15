import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_COUNT_ERROR,
  CATEGORY_DUPLICATE_ERROR,
  CATEGORY_NAME_ERROR,
  CATEGORY_NAME_MAX,
  MAX_CATEGORIES,
  normaliseCategoryList,
  normaliseCategoryName,
  onlyRenames,
} from "./category-fields.ts";

describe("normaliseCategoryName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normaliseCategoryName("  Animal   Lookalike "), "Animal Lookalike");
  });

  it("rejects blank and over-long names", () => {
    assert.equal(normaliseCategoryName("   "), null);
    assert.equal(normaliseCategoryName("a".repeat(CATEGORY_NAME_MAX + 1)), null);
    assert.equal(normaliseCategoryName("a".repeat(CATEGORY_NAME_MAX)), "a".repeat(CATEGORY_NAME_MAX));
  });
});

describe("normaliseCategoryList", () => {
  it("keeps the order and ids and normalises names", () => {
    assert.deepEqual(
      normaliseCategoryList([
        { id: "b", name: " Best  Dressed" },
        { id: null, name: "Animal Lookalike " },
      ]),
      {
        categories: [
          { id: "b", name: "Best Dressed" },
          { id: null, name: "Animal Lookalike" },
        ],
      }
    );
  });

  it("needs between one and the maximum number of categories", () => {
    assert.deepEqual(normaliseCategoryList([]), { error: CATEGORY_COUNT_ERROR });
    const tooMany = Array.from({ length: MAX_CATEGORIES + 1 }, (_, i) => ({
      id: null,
      name: `Category ${i}`,
    }));
    assert.deepEqual(normaliseCategoryList(tooMany), { error: CATEGORY_COUNT_ERROR });
  });

  it("rejects a blank name", () => {
    assert.deepEqual(
      normaliseCategoryList([{ id: "a", name: "Best Dressed" }, { id: null, name: " " }]),
      { error: CATEGORY_NAME_ERROR }
    );
  });

  it("rejects names that only differ in case or spacing", () => {
    assert.deepEqual(
      normaliseCategoryList([
        { id: "a", name: "Best Dressed" },
        { id: null, name: "best  dressed" },
      ]),
      { error: CATEGORY_DUPLICATE_ERROR }
    );
  });
});

describe("onlyRenames", () => {
  const current = [{ id: "a" }, { id: "b" }];

  it("allows the same categories in the same order, renamed or not", () => {
    assert.equal(onlyRenames(current, [{ id: "a", name: "A" }, { id: "b", name: "Renamed" }]), true);
  });

  it("spots categories that were moved, added or removed", () => {
    assert.equal(onlyRenames(current, [{ id: "b", name: "B" }, { id: "a", name: "A" }]), false);
    assert.equal(
      onlyRenames(current, [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: null, name: "C" }]),
      false
    );
    assert.equal(onlyRenames(current, [{ id: "a", name: "A" }]), false);
    assert.equal(onlyRenames(current, [{ id: "a", name: "A" }, { id: null, name: "B" }]), false);
  });
});
