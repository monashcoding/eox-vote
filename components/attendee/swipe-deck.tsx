"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Public types & constants                                          */
/* ------------------------------------------------------------------ */

export type SwipeCard = { id: string; title: string; imageUrl: string };
export type SwipeDirection = "left" | "right";

export const SWIPE_DISTANCE_THRESHOLD = 110;
export const SWIPE_DISTANCE_RATIO = 0.3;
export const SWIPE_VELOCITY_THRESHOLD = 0.5; // px/ms (500 px/s)
export const MIN_FLICK_DISTANCE = 20; // px minimum to avoid treating static taps as flicks

/* ------------------------------------------------------------------ */
/*  Decision function (pure, exported for testing)                    */
/* ------------------------------------------------------------------ */

/**
 * Pure decision function: determines if a drag gesture should dismiss
 * the card to "left" or "right", or return it to the centre (null).
 */
export function decideSwipe(
  dx: number,
  cardWidth: number,
  elapsedMs: number,
): SwipeDirection | null {
  const absDx = Math.abs(dx);
  const threshold =
    cardWidth > 0
      ? Math.min(SWIPE_DISTANCE_THRESHOLD, cardWidth * SWIPE_DISTANCE_RATIO)
      : SWIPE_DISTANCE_THRESHOLD;

  const isDistanceThreshold = absDx >= threshold;
  const velocity = elapsedMs > 0 ? absDx / elapsedMs : 0;
  const isFlick =
    absDx >= MIN_FLICK_DISTANCE && velocity >= SWIPE_VELOCITY_THRESHOLD;

  if (isDistanceThreshold || isFlick) {
    return dx > 0 ? "right" : "left";
  }

  return null;
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const FLY_DURATION_MS = 220;
const REDUCED_FADE_MS = 120;
const EASE_REVEAL = "var(--ease-reveal, cubic-bezier(0.22, 1, 0.36, 1))";

type FlightState = {
  id: string;
  card: SwipeCard;
  direction: SwipeDirection;
  phase: "flying" | "done";
};

export function SwipeDeck(props: {
  cards: SwipeCard[];
  onSwipe: (card: SwipeCard, direction: SwipeDirection) => void;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element | null {
  const { cards, onSwipe, disabled = false, className } = props;

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flight, setFlight] = useState<FlightState | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragOriginRef = useRef({ x: 0, time: 0 });

  const topCard = cards[0];
  const activeFlight =
    flight && topCard && flight.id === topCard.id ? flight : null;

  const startFlyOut = useCallback(
    (card: SwipeCard, direction: SwipeDirection) => {
      if (disabled) return;
      setDragOffset(0);
      setIsDragging(false);
      setFlight({ id: card.id, card, direction, phase: "flying" });
    },
    [disabled],
  );

  /* Fallback timer if transitionend does not fire */
  useEffect(() => {
    if (!activeFlight || activeFlight.phase !== "flying") return;
    const duration = reducedMotion
      ? REDUCED_FADE_MS + 50
      : FLY_DURATION_MS + 50;
    const timer = setTimeout(() => {
      const { card, direction } = activeFlight;
      setFlight({ id: card.id, card, direction, phase: "done" });
      onSwipe(card, direction);
    }, duration);
    return () => clearTimeout(timer);
  }, [activeFlight, reducedMotion, onSwipe]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!activeFlight || activeFlight.phase !== "flying") return;

      const { card, direction } = activeFlight;
      setFlight({ id: card.id, card, direction, phase: "done" });
      onSwipe(card, direction);
    },
    [activeFlight, onSwipe],
  );

  /* ---- Pointer gesture handlers ---- */
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || activeFlight !== null || e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
      dragOriginRef.current = { x: e.clientX, time: Date.now() };
      setIsDragging(true);
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
      const elapsed = Date.now() - dragOriginRef.current.time;
      const cardWidth = cardRef.current?.offsetWidth ?? 320;
      const decision = decideSwipe(dx, cardWidth, elapsed);

      if (decision !== null && topCard) {
        startFlyOut(topCard, decision);
      } else {
        setDragOffset(0);
      }
    },
    [disabled, isDragging, activeFlight, topCard, startFlyOut],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      pointerIdRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
    },
    [],
  );

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
      }
    },
    [disabled, activeFlight, topCard, startFlyOut],
  );

  /* Empty check */
  if (cards.length === 0) return null;

  const visibleCards = cards.slice(0, 3);
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

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Swipe deck. Use the left and right arrow keys to skip or vote."
      onKeyDown={onKeyDown}
      className={cn(
        "animate-rise-in flex flex-col items-center gap-6 rounded-panel outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {/* Card stack container */}
      <div
        className="relative aspect-3/4 w-full max-w-xs select-none sm:max-w-sm"
        style={{ touchAction: "pan-y" }}
      >
        {visibleCards.map((card, index) => {
          const isTop = index === 0;

          // Background cards scale and lift as the top card is moved (skipped under reduced motion)
          const baseScale = 1 - index * 0.05;
          const baseY = index * 10;
          const targetScale = 1 - (index - 1) * 0.05;
          const targetY = (index - 1) * 10;
          const progress = reducedMotion ? 0 : gestureProgress;
          const currentScale = baseScale + (targetScale - baseScale) * progress;
          const currentY = baseY + (targetY - baseY) * progress;

          let transform = `scale(${currentScale}) translateY(${currentY}px)`;
          let transition = isDragging
            ? "none"
            : reducedMotion
              ? "none"
              : `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;
          let opacity: number | undefined;

          if (isTop) {
            const rotationDeg = Math.max(
              -12,
              Math.min(12, (dragOffset / 280) * 12)
            );

            if (activeFlight?.phase === "flying") {
              if (reducedMotion) {
                transform = "none";
                transition = `opacity ${REDUCED_FADE_MS}ms ${EASE_REVEAL}`;
                opacity = 0;
              } else {
                const flyX =
                  activeFlight.direction === "right" ? "120vw" : "-120vw";
                const flyRot = activeFlight.direction === "right" ? 15 : -15;
                transform = `translate3d(${flyX}, 0, 0) rotate(${flyRot}deg)`;
                transition = `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;
              }
            } else if (activeFlight?.phase === "done") {
              transform = "none";
              transition = "none";
              opacity = 0;
            } else if (isDragging) {
              // Reduced motion: the card stays put, the Vote/Skip tag still shows the direction.
              transform = reducedMotion
                ? "none"
                : `translate3d(${dragOffset}px, 0, 0) rotate(${rotationDeg}deg)`;
              transition = "none";
            } else {
              transform = "translate3d(0, 0, 0) rotate(0deg)";
              transition = reducedMotion
                ? "none"
                : `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;
            }
          }

          const zIndex = isTop ? 30 : index === 1 ? 20 : 10;

          return (
            <div
              key={card.id}
              ref={isTop ? cardRef : undefined}
              role="group"
              aria-label={card.title}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerCancel : undefined}
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
                    <Check aria-hidden />
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

      {/* Control buttons: same actions as the gestures */}
      <div className="flex items-center gap-6">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Skip"
          disabled={isActionDisabled}
          onClick={() => topCard && startFlyOut(topCard, "left")}
          className="size-14 md:size-11"
        >
          <X className="size-6" />
        </Button>
        <Button
          type="button"
          size="icon"
          aria-label="Vote"
          disabled={isActionDisabled}
          onClick={() => topCard && startFlyOut(topCard, "right")}
          className="size-14 md:size-11"
        >
          <Check className="size-6" />
        </Button>
      </div>
    </div>
  );
}
