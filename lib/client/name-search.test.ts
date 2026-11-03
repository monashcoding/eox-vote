import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesNameQuery } from "./name-search.ts";

describe("matchesNameQuery", () => {
  it("matches everyone when the query is empty or blank", () => {
    assert.equal(matchesNameQuery("Ada", "Lovelace", ""), true);
    assert.equal(matchesNameQuery("Ada", "Lovelace", "   "), true);
  });

  it("matches part of either name, ignoring case", () => {
    assert.equal(matchesNameQuery("Ada", "Lovelace", "LOVE"), true);
    assert.equal(matchesNameQuery("Ada", "Lovelace", "turing"), false);
  });

  it("needs every word, in any order, across first and last name", () => {
    assert.equal(matchesNameQuery("Ada", "Lovelace", "lovelace ada"), true);
    assert.equal(matchesNameQuery("Ada", "Lovelace", "ada turing"), false);
  });

  it("ignores accents on either side", () => {
    assert.equal(matchesNameQuery("Zoë", "Ngô", "zoe ngo"), true);
    assert.equal(matchesNameQuery("Zoe", "Ngo", "Zoë"), true);
  });
});
