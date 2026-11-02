import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideSwipe, swipeDistanceThreshold } from "./swipe-decision.ts";

// A slow drag: 1000 ms is far below flick speed for any distance tested here.
const SLOW = 1000;

describe("decideSwipe", () => {
  it("returns a short slow drag to the centre", () => {
    assert.equal(decideSwipe(60, 400, SLOW), null);
    assert.equal(decideSwipe(-60, 400, SLOW), null);
  });

  it("dismisses once a wide card is dragged 110 px", () => {
    assert.equal(decideSwipe(109, 400, SLOW), null);
    assert.equal(decideSwipe(110, 400, SLOW), "right");
    assert.equal(decideSwipe(-110, 400, SLOW), "left");
  });

  it("uses 30% of the width on narrow cards", () => {
    // 300 px card: threshold is 90 px, not 110 px.
    assert.equal(decideSwipe(89, 300, SLOW), null);
    assert.equal(decideSwipe(90, 300, SLOW), "right");
    assert.equal(decideSwipe(-90, 300, SLOW), "left");
  });

  it("falls back to 110 px when the card width is unknown", () => {
    assert.equal(decideSwipe(109, 0, SLOW), null);
    assert.equal(decideSwipe(110, 0, SLOW), "right");
  });

  it("dismisses a fast flick below the distance threshold", () => {
    // 40 px in 50 ms is 0.8 px/ms, above 0.5 px/ms.
    assert.equal(decideSwipe(40, 400, 50), "right");
    assert.equal(decideSwipe(-40, 400, 50), "left");
    // 40 px in 100 ms is 0.4 px/ms: too slow.
    assert.equal(decideSwipe(40, 400, 100), null);
  });

  it("does not treat a quick tap as a flick", () => {
    // 19 px in 5 ms is fast, but under the 20 px flick minimum.
    assert.equal(decideSwipe(19, 400, 5), null);
    assert.equal(decideSwipe(0, 400, 0), null);
    assert.equal(decideSwipe(5, 400, 0), null);
  });
});

describe("swipeDistanceThreshold", () => {
  it("is 110 px on wide cards and 30% of the width on narrow ones", () => {
    assert.equal(swipeDistanceThreshold(400), 110);
    assert.equal(swipeDistanceThreshold(200), 60);
    assert.equal(swipeDistanceThreshold(0), 110);
  });
});
