import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseSponsorName,
  normaliseSponsorShortName,
} from "./sponsor-fields.ts";

describe("normaliseSponsorName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(
      normaliseSponsorName("  Computing and   Information\tSystems "),
      "Computing and Information Systems"
    );
  });

  it("rejects blank and over-long names", () => {
    assert.equal(normaliseSponsorName("   "), null);
    assert.equal(normaliseSponsorName("a".repeat(81)), null);
    assert.equal(normaliseSponsorName("a".repeat(80)), "a".repeat(80));
  });
});

describe("normaliseSponsorShortName", () => {
  it("treats blank as no short name", () => {
    assert.equal(normaliseSponsorShortName(""), null);
    assert.equal(normaliseSponsorShortName("   "), null);
  });

  it("keeps a short name and rejects one over 20 characters", () => {
    assert.equal(normaliseSponsorShortName(" CISSA "), "CISSA");
    assert.equal(normaliseSponsorShortName("a".repeat(20)), "a".repeat(20));
    assert.equal(normaliseSponsorShortName("a".repeat(21)), undefined);
  });
});
