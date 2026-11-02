import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { qrFilename, slugify } from "./qr-filename.ts";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    assert.equal(slugify("Best Dressed 2026"), "best-dressed-2026");
  });

  it("folds accents and drops punctuation at the edges", () => {
    assert.equal(slugify("  Café Night!! "), "cafe-night");
  });

  it("collapses runs of symbols", () => {
    assert.equal(slugify("a / b -- c"), "a-b-c");
  });

  it("falls back when nothing usable remains", () => {
    assert.equal(slugify("***"), "session");
    assert.equal(slugify(""), "session");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    assert.equal(slug, "a".repeat(59));
  });
});

describe("qrFilename", () => {
  it("appends the qr suffix and png extension", () => {
    assert.equal(qrFilename("Best Dressed 2026"), "best-dressed-2026-qr.png");
  });
});
