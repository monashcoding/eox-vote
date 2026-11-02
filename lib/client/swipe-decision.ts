export type SwipeDirection = "left" | "right";

const SWIPE_DISTANCE_THRESHOLD = 110; // px
const SWIPE_DISTANCE_RATIO = 0.3; // of the card width, for narrow cards
const SWIPE_VELOCITY_THRESHOLD = 0.5; // px/ms (500 px/s)
const MIN_FLICK_DISTANCE = 20; // px, so a quick tap never counts as a flick
const TAP_MAX_MOVE = 10; // px in any direction
const TAP_MAX_MS = 400;

/** Drag distance that dismisses a card: 110 px, or 30% of a narrow card's width. */
export function swipeDistanceThreshold(cardWidth: number): number {
  return cardWidth > 0
    ? Math.min(SWIPE_DISTANCE_THRESHOLD, cardWidth * SWIPE_DISTANCE_RATIO)
    : SWIPE_DISTANCE_THRESHOLD;
}

/**
 * Decides whether a finished drag dismisses the card to the left or right,
 * or returns it to the centre (null).
 */
export function decideSwipe(
  dx: number,
  cardWidth: number,
  elapsedMs: number,
): SwipeDirection | null {
  const absDx = Math.abs(dx);
  const isDistanceThreshold = absDx >= swipeDistanceThreshold(cardWidth);
  const velocity = elapsedMs > 0 ? absDx / elapsedMs : 0;
  const isFlick =
    absDx >= MIN_FLICK_DISTANCE && velocity >= SWIPE_VELOCITY_THRESHOLD;

  if (isDistanceThreshold || isFlick) {
    return dx > 0 ? "right" : "left";
  }

  return null;
}

/** A press that barely moved and was released quickly: open the photo, not a swipe. */
export function isTap(dx: number, dy: number, elapsedMs: number): boolean {
  return Math.hypot(dx, dy) < TAP_MAX_MOVE && elapsedMs < TAP_MAX_MS;
}
