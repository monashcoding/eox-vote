import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fitLine } from "./fit-line.ts";

describe("fitLine", () => {
  it("keeps full size when the line already fits", () => {
    assert.deepEqual(fitLine(200, 280, 0.5), { scale: 1, wrap: false });
    assert.deepEqual(fitLine(280, 280, 0.5), { scale: 1, wrap: false });
  });

  it("shrinks a line that is too wide so it fits exactly", () => {
    assert.deepEqual(fitLine(400, 280, 0.5), { scale: 0.7, wrap: false });
    assert.deepEqual(fitLine(560, 280, 0.5), { scale: 0.5, wrap: false });
  });

  it("stops shrinking at the minimum and wraps instead", () => {
    assert.deepEqual(fitLine(1400, 280, 0.5), { scale: 0.5, wrap: true });
  });

  it("leaves the line alone before anything has been measured", () => {
    assert.deepEqual(fitLine(0, 280, 0.5), { scale: 1, wrap: false });
    assert.deepEqual(fitLine(400, 0, 0.5), { scale: 1, wrap: false });
  });
});
