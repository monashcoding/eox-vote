import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NOMINATIONS_PER_DEVICE,
  MAX_NOMINATIONS_PER_SESSION,
  nominationLimitError,
} from "./nomination-limits.ts";

describe("nominationLimitError", () => {
  it("allows nominations under both caps", () => {
    assert.equal(nominationLimitError(0, 0), null);
    assert.equal(
      nominationLimitError(MAX_NOMINATIONS_PER_DEVICE - 1, MAX_NOMINATIONS_PER_SESSION - 1),
      null
    );
  });

  it("blocks the device once it has the maximum", () => {
    assert.match(
      nominationLimitError(MAX_NOMINATIONS_PER_DEVICE, 10) ?? "",
      /up to 5 people/
    );
  });

  it("blocks everyone once the session is full", () => {
    assert.match(
      nominationLimitError(0, MAX_NOMINATIONS_PER_SESSION) ?? "",
      /already has 300 nominations/
    );
  });
});
