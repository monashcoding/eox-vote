"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SwipeDirection } from "@/lib/client/swipe-decision";
import { cn } from "@/lib/utils";
import { SwipeButtons, SwipeGlow, SwipeTag } from "./swipe-feedback";
import {
  EASE_REVEAL,
  FLY_DURATION_MS,
  REDUCED_FADE_MS,
  usePrefersReducedMotion,
  useSwipeGesture,
} from "./use-swipe-gesture";

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export type SwipeCard = { id: string; title: string; imageUrl: string };

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const DEAL_DURATION_MS = 260;
const DEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/*
 * Resting pose of each layer, top card first: a loose pile of playing cards
 * whose edges peek out at different angles. A card takes the next layer's
 * pose as the card above it is dragged off, so the pile settles as you swipe.
 */
const PILE = [
  { x: 0, y: 0, rotate: -1.5 },
  { x: 3, y: 2, rotate: 2.5 },
  { x: -4, y: 4, rotate: -4 },
  { x: 5, y: 6, rotate: 5.5 },
] as const;
const PILE_SIZE = PILE.length;

/**
 * Transform for a card on `layer`, `progress` (0 to 1) of the way to the
 * layer above. Reduced motion keeps the offsets but drops the rotation.
 */
function pileTransform(
  layer: number,
  progress: number,
  reducedMotion: boolean,
  dragX = 0,
  dragRotate = 0
): string {
  const from = PILE[layer];
  const to = PILE[Math.max(0, layer - 1)];
  const x = from.x + (to.x - from.x) * progress + dragX;
  const y = from.y + (to.y - from.y) * progress;
  const rotate = reducedMotion
    ? 0
    : from.rotate + (to.rotate - from.rotate) * progress + dragRotate;
  return `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`;
}

export function SwipeDeck(props: {
  cards: SwipeCard[];
  onSwipe: (card: SwipeCard, direction: SwipeDirection) => void;
  /** Takes back the last swipe; the Undo button shows when this is set. */
  onUndo?: () => void;
  canUndo?: boolean;
  /** A card that undo put back: it flies in from the side it left by. */
  returningCard?: { id: string; direction: SwipeDirection } | null;
  /** Tapping the top card (or Enter on the deck) shows its photo larger. */
  onOpenCard?: (card: SwipeCard) => void;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element | null {
  const {
    cards,
    onSwipe,
    onUndo,
    canUndo = false,
    returningCard = null,
    onOpenCard,
    disabled = false,
    className,
  } = props;

  const reducedMotion = usePrefersReducedMotion();

  const pileRef = useRef<HTMLDivElement | null>(null);
  const shownIdsRef = useRef<ReadonlySet<string> | null>(null);

  /*
   * Undo: the card put back flies in from the side it left by (a fade under
   * reduced motion). Deal: when a swipe brings a new card into the pile, it
   * rotates out from behind the card that was at the bottom (now one layer
   * up) to its own pose. Neither runs on first render; the deal also skips
   * reduced motion and a card coming back on top after a failed vote.
   */
  const pileKey = cards
    .slice(0, PILE_SIZE)
    .map((card) => card.id)
    .join("|");
  useLayoutEffect(() => {
    const ids = pileKey ? pileKey.split("|") : [];
    const previous = shownIdsRef.current;
    shownIdsRef.current = new Set(ids);
    if (!previous) return;
    if (
      returningCard &&
      ids[0] === returningCard.id &&
      !previous.has(returningCard.id)
    ) {
      const side = returningCard.direction === "right" ? 1 : -1;
      pileRef.current
        ?.querySelector<HTMLElement>(
          `[data-card-id="${CSS.escape(returningCard.id)}"]`
        )
        ?.animate(
          reducedMotion
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                {
                  transform: `translate3d(${side * 120}vw, 0, 0) rotate(${side * 15}deg)`,
                },
                { transform: pileTransform(0, 0, false) },
              ],
          {
            duration: reducedMotion ? REDUCED_FADE_MS : FLY_DURATION_MS,
            easing: DEAL_EASING,
          }
        );
      return;
    }
    if (reducedMotion || ids.length < PILE_SIZE) return;
    const dealtId = ids[PILE_SIZE - 1];
    if (previous.has(dealtId) || !previous.has(ids[0])) return;
    pileRef.current
      ?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(dealtId)}"]`)
      ?.animate(
        [
          { transform: pileTransform(PILE_SIZE - 2, 0, false) },
          { transform: pileTransform(PILE_SIZE - 1, 0, false) },
        ],
        { duration: DEAL_DURATION_MS, easing: DEAL_EASING }
      );
  }, [pileKey, reducedMotion, returningCard]);

  const topCard = cards[0] ?? null;
  const gesture = useSwipeGesture({
    card: topCard,
    onSwipe,
    onTap: onOpenCard,
    disabled,
  });

  /* ---- Keyboard controls ---- */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (gesture.busy || !topCard) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        gesture.swipe("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        gesture.swipe("right");
      } else if (
        e.key === "Enter" &&
        onOpenCard &&
        // Only on the deck itself: Enter on Undo/Skip/Vote must stay a click.
        e.target === e.currentTarget
      ) {
        e.preventDefault();
        onOpenCard(topCard);
      }
    },
    [gesture, topCard, onOpenCard],
  );

  /* Empty check */
  if (cards.length === 0) return null;

  const visibleCards = cards.slice(0, PILE_SIZE);

  return (
    <div
      data-swipe-deck
      tabIndex={0}
      role="region"
      aria-label={
        onOpenCard
          ? "Swipe deck. Use the left and right arrow keys to skip or vote, and Enter or a tap on the photo to see it larger."
          : "Swipe deck. Use the left and right arrow keys to skip or vote."
      }
      onKeyDown={onKeyDown}
      className={cn(
        // A size container: the card is sized from the space the parent
        // gives the deck, so the card and Skip/Vote always fit together.
        "animate-rise-in flex flex-col items-center gap-6 rounded-panel outline-none [container-type:size] [--deck-controls-w:10rem] [--deck-max:20rem] focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:[--deck-max:24rem] compact:[--deck-controls-w:8.5rem] short:flex-row short:justify-center",
        // Height the controls take under the card, gap included: Undo row
        // plus the Skip/Vote row, or just Skip/Vote.
        onUndo
          ? "[--deck-controls-h:8.25rem] compact:[--deck-controls-h:7rem]"
          : "[--deck-controls-h:5rem] compact:[--deck-controls-h:4.25rem]",
        className
      )}
    >
      {/* Card stack: 3:4 and as wide as the deck allows once the controls
          (--deck-controls-h) are taken out of its height, less 2rem across
          for the rotated cards' corners. Short (landscape) viewports put the
          controls beside the card, so the width gives up
          --deck-controls-w instead. */}
      <div
        ref={pileRef}
        className="relative aspect-3/4 w-[min(var(--deck-max),calc(100cqw_-_2rem),calc((100cqh_-_var(--deck-controls-h))*0.75))] shrink-0 select-none short:w-[min(calc(100cqh*0.75),calc(100cqw_-_var(--deck-controls-w)_-_2rem))]"
        style={{ touchAction: "pan-y" }}
      >
        {visibleCards.map((card, index) => {
          const isTop = index === 0;

          // Cards below take the pose of the layer above as the top card is
          // dragged off (held still under reduced motion).
          const motion = isTop
            ? gesture.style((dragX, dragRotate, reduced) =>
                pileTransform(0, 0, reduced, dragX, dragRotate)
              )
            : {
                transform: pileTransform(
                  index,
                  reducedMotion ? 0 : gesture.progress,
                  reducedMotion
                ),
                transition:
                  gesture.isDragging || reducedMotion
                    ? "none"
                    : `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`,
              };
          const zIndex = (PILE_SIZE - index) * 10;

          return (
            <div
              key={card.id}
              data-card-id={card.id}
              ref={isTop ? gesture.ref : undefined}
              role="group"
              aria-label={card.title}
              {...(isTop ? gesture.handlers : undefined)}
              style={{
                ...motion,
                zIndex,
                touchAction: "pan-y",
                willChange: isTop ? "transform, opacity" : undefined,
              }}
              className={cn(
                "absolute inset-0 flex flex-col overflow-hidden rounded-panel border-2 border-border bg-card select-none",
                isTop && "cursor-grab active:cursor-grabbing"
              )}
            >
              <img
                src={card.imageUrl}
                alt={card.title}
                draggable={false}
                className="pointer-events-none min-h-0 w-full flex-1 object-cover select-none"
              />
              <p className="truncate border-t border-border bg-card px-4 py-3 text-base font-semibold">
                {card.title}
              </p>

              {/* Direction tags: icon + word, never colour alone */}
              {isTop && <SwipeTag tag={gesture.tag} />}
            </div>
          );
        })}
      </div>

      {/* Controls: Undo above Skip/Vote, the same actions as the gestures.
          Beside the card in short viewports they sit at its bottom edge, in
          thumb reach and clear of the vote error over the top of the deck. */}
      <div className="flex shrink-0 flex-col gap-2 short:self-end">
        {onUndo && (
          <Button
            type="button"
            variant="ghost"
            disabled={!canUndo || gesture.busy}
            onClick={onUndo}
            className="text-muted"
          >
            <Undo2 />
            Undo
          </Button>
        )}
        <SwipeButtons onSwipe={gesture.swipe} disabled={gesture.busy} />
      </div>

      {/* Portalled to <body>: the deck is a size container, which would trap
          fixed-position children inside it. */}
      <SwipeGlow glow={gesture.glow} />
    </div>
  );
}
