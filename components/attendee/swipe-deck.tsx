"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Heart, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import {
  decideSwipe,
  isTap,
  swipeDistanceThreshold,
  type SwipeDirection,
} from "@/lib/client/swipe-decision";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export type SwipeCard = { id: string; title: string; imageUrl: string };

/* ------------------------------------------------------------------ */
/*  Reduced-motion subscription (SSR safe, zero re-render loops)      */
/* ------------------------------------------------------------------ */

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/* The glow portal needs document.body, so it renders after hydration only. */
function subscribeNever(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const FLY_DURATION_MS = 220;
const REDUCED_FADE_MS = 120;
const EASE_REVEAL = "var(--ease-reveal, cubic-bezier(0.22, 1, 0.36, 1))";
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

type FlightState = {
  id: string;
  card: SwipeCard;
  direction: SwipeDirection;
};

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

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flight, setFlight] = useState<FlightState | null>(null);
  // Distance at which the glow reaches full strength: the swipe threshold.
  const [dragThreshold, setDragThreshold] = useState(swipeDistanceThreshold(0));
  const isClient = useSyncExternalStore(
    subscribeNever,
    getClientSnapshot,
    getReducedMotionServerSnapshot,
  );

  const cardRef = useRef<HTMLDivElement | null>(null);
  const pileRef = useRef<HTMLDivElement | null>(null);
  const shownIdsRef = useRef<ReadonlySet<string> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragOriginRef = useRef({ x: 0, y: 0, time: 0 });
  // Set by a tap's pointerup; the click that follows opens the photo. Opening
  // on pointerup instead would let that click land on the new preview and
  // close it straight away.
  const tapRef = useRef(false);

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

  const topCard = cards[0];
  const activeFlight =
    flight && topCard && flight.id === topCard.id ? flight : null;

  const startFlyOut = useCallback(
    (card: SwipeCard, direction: SwipeDirection) => {
      if (disabled) return;
      setDragOffset(0);
      setIsDragging(false);
      setFlight({ id: card.id, card, direction });
    },
    [disabled],
  );

  /*
   * Hand the card over and end the flight in the same batch, so the parent
   * removes it before it can render again. A card that comes back (failed
   * vote rollback) then renders normally instead of staying hidden.
   */
  const finishFlight = useCallback(
    (current: FlightState) => {
      setFlight(null);
      onSwipe(current.card, current.direction);
    },
    [onSwipe],
  );

  /* Fallback timer if transitionend does not fire */
  useEffect(() => {
    if (!activeFlight) return;
    const duration = reducedMotion
      ? REDUCED_FADE_MS + 50
      : FLY_DURATION_MS + 50;
    const timer = setTimeout(() => finishFlight(activeFlight), duration);
    return () => clearTimeout(timer);
  }, [activeFlight, reducedMotion, finishFlight]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!activeFlight) return;
      finishFlight(activeFlight);
    },
    [activeFlight, finishFlight],
  );

  /* ---- Pointer gesture handlers ---- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || activeFlight !== null || e.button !== 0) return;
      tapRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
      dragOriginRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      setIsDragging(true);
      setDragThreshold(
        swipeDistanceThreshold(cardRef.current?.offsetWidth ?? 0)
      );
      setDragOffset(0);
    },
    [disabled, activeFlight],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || pointerIdRef.current !== e.pointerId) return;
      setDragOffset(e.clientX - dragOriginRef.current.x);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || pointerIdRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      pointerIdRef.current = null;
      setIsDragging(false);

      if (disabled || activeFlight !== null) {
        setDragOffset(0);
        return;
      }

      const dx = e.clientX - dragOriginRef.current.x;
      const dy = e.clientY - dragOriginRef.current.y;
      const elapsed = Date.now() - dragOriginRef.current.time;

      if (onOpenCard && topCard && isTap(dx, dy, elapsed)) {
        tapRef.current = true;
        setDragOffset(0);
        return;
      }

      const cardWidth = cardRef.current?.offsetWidth ?? 320;
      const decision = decideSwipe(dx, cardWidth, elapsed);

      if (decision !== null && topCard) {
        startFlyOut(topCard, decision);
      } else {
        setDragOffset(0);
      }
    },
    [disabled, isDragging, activeFlight, topCard, startFlyOut, onOpenCard],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      pointerIdRef.current = null;
      tapRef.current = false;
      setIsDragging(false);
      setDragOffset(0);
    },
    [],
  );

  const onCardClick = useCallback(() => {
    if (!tapRef.current) return;
    tapRef.current = false;
    if (onOpenCard && topCard && !disabled && activeFlight === null) {
      onOpenCard(topCard);
    }
  }, [onOpenCard, topCard, disabled, activeFlight]);

  /* ---- Keyboard controls ---- */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || activeFlight !== null || !topCard) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        startFlyOut(topCard, "left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        startFlyOut(topCard, "right");
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
    [disabled, activeFlight, topCard, startFlyOut, onOpenCard],
  );

  /* Empty check */
  if (cards.length === 0) return null;

  const visibleCards = cards.slice(0, PILE_SIZE);
  const dragProgress = Math.min(1, Math.abs(dragOffset) / 120);
  const gestureProgress = activeFlight !== null ? 1 : dragProgress;

  /* Overlays on top card */
  const showVoteOverlay =
    (isDragging && dragOffset > 0) ||
    (activeFlight !== null && activeFlight.direction === "right");
  const showSkipOverlay =
    (isDragging && dragOffset < 0) ||
    (activeFlight !== null && activeFlight.direction === "left");
  const overlayOpacity = isDragging
    ? Math.min(1, Math.abs(dragOffset) / 90)
    : 1;

  const isActionDisabled = disabled || activeFlight !== null;

  /*
   * Edge glow: red on the left while dragging left, green on the right while
   * dragging right, full strength at the swipe threshold. A committed swipe
   * (gesture, button or arrow key) holds it during the fly-out, then it fades.
   */
  let glowSide: SwipeDirection | null = null;
  let glowOpacity = 0;
  if (activeFlight) {
    glowSide = activeFlight.direction;
    glowOpacity = 1;
  } else if (isDragging && dragOffset !== 0) {
    glowSide = dragOffset > 0 ? "right" : "left";
    glowOpacity = Math.min(1, Math.abs(dragOffset) / dragThreshold);
  }
  const glowTransition =
    isDragging || reducedMotion
      ? "none"
      : `opacity ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;

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
          const progress = reducedMotion ? 0 : gestureProgress;
          let transform = pileTransform(index, isTop ? 0 : progress, reducedMotion);
          let transition =
            isDragging || reducedMotion
              ? "none"
              : `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;
          let opacity: number | undefined;

          if (isTop) {
            const rotationDeg = Math.max(
              -12,
              Math.min(12, (dragOffset / 280) * 12)
            );

            if (activeFlight) {
              if (reducedMotion) {
                transition = `opacity ${REDUCED_FADE_MS}ms ${EASE_REVEAL}`;
                opacity = 0;
              } else {
                const flyX =
                  activeFlight.direction === "right" ? "120vw" : "-120vw";
                const flyRot = activeFlight.direction === "right" ? 15 : -15;
                transform = `translate3d(${flyX}, 0, 0) rotate(${flyRot}deg)`;
              }
            } else if (isDragging && !reducedMotion) {
              // Reduced motion: the card stays put, the Vote/Skip tag still shows the direction.
              transform = pileTransform(0, 0, false, dragOffset, rotationDeg);
            }
          }

          const zIndex = (PILE_SIZE - index) * 10;

          return (
            <div
              key={card.id}
              data-card-id={card.id}
              ref={isTop ? cardRef : undefined}
              role="group"
              aria-label={card.title}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerCancel : undefined}
              onClick={isTop ? onCardClick : undefined}
              onTransitionEnd={isTop ? handleTransitionEnd : undefined}
              style={{
                transform,
                transition,
                opacity,
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
              {isTop && showVoteOverlay && (
                <div
                  className="pointer-events-none absolute top-3 left-3 rounded-tag bg-card select-none"
                  style={{ opacity: overlayOpacity }}
                >
                  <Badge variant="success" tag>
                    <Heart aria-hidden fill="currentColor" />
                    Vote
                  </Badge>
                </div>
              )}
              {isTop && showSkipOverlay && (
                <div
                  className="pointer-events-none absolute top-3 right-3 rounded-control bg-card select-none"
                  style={{ opacity: overlayOpacity }}
                >
                  <Badge variant="outline" tag>
                    <X aria-hidden />
                    Skip
                  </Badge>
                </div>
              )}
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
            disabled={!canUndo || isActionDisabled}
            onClick={onUndo}
            className="text-muted"
          >
            <Undo2 />
            Undo
          </Button>
        )}
        <div className="flex items-center gap-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Skip"
            disabled={isActionDisabled}
            onClick={() => topCard && startFlyOut(topCard, "left")}
            className="size-14 compact:size-11"
          >
            <X className="size-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            aria-label="Vote"
            disabled={isActionDisabled}
            onClick={() => topCard && startFlyOut(topCard, "right")}
            className="size-14 compact:size-11"
          >
            <Heart className="size-6" fill="currentColor" />
          </Button>
        </div>
      </div>

      {/* Portalled to <body>: the deck is a size container, which would trap
          fixed-position children inside it. */}
      {isClient &&
        createPortal(
          <>
            <div
              aria-hidden
              data-swipe-glow="left"
              className="pointer-events-none fixed inset-y-0 left-0 z-50 w-[calc(5rem+env(safe-area-inset-left,0px))] bg-linear-to-r from-danger/45 to-transparent"
              style={{
                opacity: glowSide === "left" ? glowOpacity : 0,
                transition: glowTransition,
              }}
            />
            <div
              aria-hidden
              data-swipe-glow="right"
              className="pointer-events-none fixed inset-y-0 right-0 z-50 w-[calc(5rem+env(safe-area-inset-right,0px))] bg-linear-to-l from-success/45 to-transparent"
              style={{
                opacity: glowSide === "right" ? glowOpacity : 0,
                transition: glowTransition,
              }}
            />
          </>,
          document.body
        )}
    </div>
  );
}
