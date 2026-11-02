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
import { decideSwipe, type SwipeDirection } from "@/lib/client/swipe-decision";
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
      data-swipe-deck
      tabIndex={0}
      role="region"
      aria-label="Swipe deck. Use the left and right arrow keys to skip or vote."
      onKeyDown={onKeyDown}
      className={cn(
        // A size container: the card is sized from the space the parent
        // gives the deck, so the card and Skip/Vote always fit together.
        "animate-rise-in flex flex-col items-center gap-6 rounded-panel outline-none [container-type:size] [--deck-controls:5rem] [--deck-max:20rem] focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:[--deck-max:24rem] compact:[--deck-controls:4.25rem] short:flex-row short:justify-center",
        className
      )}
    >
      {/* Card stack: 3:4 and as wide as the deck allows once the Skip/Vote
          row (--deck-controls: button plus gap) is taken out of its height.
          Short (landscape) viewports put the buttons beside the card, so the
          width gives up that space instead. */}
      <div
        className="relative aspect-3/4 w-[min(var(--deck-max),100cqw,calc((100cqh_-_var(--deck-controls))*0.75))] shrink-0 select-none short:w-[min(calc(100cqh*0.75),calc(100cqw_-_var(--deck-controls)))]"
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

            if (activeFlight) {
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
      <div className="flex shrink-0 items-center gap-6 short:flex-col">
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
          <Check className="size-6" />
        </Button>
      </div>
    </div>
  );
}
