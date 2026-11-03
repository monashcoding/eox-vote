"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  decideSwipe,
  isTap,
  swipeDistanceThreshold,
  type SwipeDirection,
} from "@/lib/client/swipe-decision";

export const FLY_DURATION_MS = 220;
export const REDUCED_FADE_MS = 120;
export const EASE_REVEAL = "var(--ease-reveal, cubic-bezier(0.22, 1, 0.36, 1))";

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

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

/* ------------------------------------------------------------------ */
/*  Gesture                                                           */
/* ------------------------------------------------------------------ */

type FlightState<T> = {
  id: string;
  card: T;
  direction: SwipeDirection;
};

/** How the swiped element sits, given the drag: a transform string. */
export type SwipePose = (
  dragX: number,
  dragRotate: number,
  reducedMotion: boolean,
) => string;

export type SwipeGesture = {
  /** Attach to the element that is dragged; its width sets the thresholds. */
  ref: React.RefObject<HTMLDivElement | null>;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
    onClick: () => void;
    onTransitionEnd: (e: React.TransitionEvent<HTMLDivElement>) => void;
  };
  /** Starts the fly-out for the current card (buttons and arrow keys). */
  swipe: (direction: SwipeDirection) => void;
  /** A flight is under way (or the gesture is disabled): ignore new input. */
  busy: boolean;
  isDragging: boolean;
  /** 0 to 1: how far the drag, or a flight, has gone. */
  progress: number;
  /** Transform, transition and opacity for the dragged element. */
  style: (pose: SwipePose) => React.CSSProperties;
  /** The Vote or Skip tag to show, if any, with its opacity. */
  tag: { direction: SwipeDirection; opacity: number } | null;
  /** The edge glow to show, if any. */
  glow: { side: SwipeDirection | null; opacity: number; transition: string };
  /**
   * True once after the pointer went up from a real drag (not a tap), so the
   * click that follows can be ignored; reading it clears it.
   */
  consumeDrag: () => boolean;
};

/**
 * Drag, fly-out, tags and glow for one swipeable card: pointer events with
 * capture, a flick or long drag past the threshold flies the card out and
 * calls `onSwipe`, anything else snaps back. The deck's top card and the full
 * size photo both use it, so they decide and move the same way. `onTap` makes
 * a tap (not a swipe) call back from the click that follows it.
 */
export function useSwipeGesture<T extends { id: string }>({
  card,
  onSwipe,
  onTap,
  disabled = false,
}: {
  card: T | null;
  onSwipe: (card: T, direction: SwipeDirection) => void;
  onTap?: (card: T) => void;
  disabled?: boolean;
}): SwipeGesture {
  const reducedMotion = usePrefersReducedMotion();

  const [dragOffset, setDragOffset] = useState(0);
  // The card a drag in progress started on, or null when not dragging.
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [flight, setFlight] = useState<FlightState<T> | null>(null);
  // Distance at which the glow reaches full strength: the swipe threshold.
  const [dragThreshold, setDragThreshold] = useState(swipeDistanceThreshold(0));

  const ref = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragOriginRef = useRef({ x: 0, y: 0, time: 0 });
  // Set by a tap's pointerup; the click that follows calls onTap. Acting on
  // pointerup instead would let that click land on what the tap opened and
  // close it straight away.
  const tapRef = useRef(false);
  // Set when a drag ends; a click that follows it must not count as a tap on
  // anything (a mouse drag ending over the backdrop, for one).
  const draggedRef = useRef(false);

  /*
   * A drag belongs to the card it started on. When that card stops being the
   * current one (a failed vote put another on top) or the gesture is switched
   * off (the preview closed), the drag ends here: the next card never takes
   * it over on release, and a drag whose pointerup never arrived does not
   * come back the next time the card shows.
   */
  if (dragCardId !== null && (dragCardId !== card?.id || disabled)) {
    setDragCardId(null);
    setDragOffset(0);
  }
  const isDragging = dragCardId !== null;

  const activeFlight = flight && card && flight.id === card.id ? flight : null;

  const startFlyOut = useCallback(
    (target: T, direction: SwipeDirection) => {
      if (disabled) return;
      setDragOffset(0);
      setDragCardId(null);
      setFlight({ id: target.id, card: target, direction });
    },
    [disabled],
  );

  /*
   * Hand the card over and end the flight in the same batch, so the parent
   * removes it before it can render again. A card that comes back (failed
   * vote rollback) then renders normally instead of staying hidden.
   */
  const finishFlight = useCallback(
    (current: FlightState<T>) => {
      setFlight(null);
      onSwipe(current.card, current.direction);
    },
    [onSwipe],
  );

  /*
   * Fallback if transitionend does not fire. It follows the stored flight, not
   * activeFlight: a flight whose card stopped being the current one (a failed
   * vote put another card on top mid-flight) still lands, once, here. Left in
   * state, it would land on its own later, whenever that card next came back
   * on top.
   */
  useEffect(() => {
    if (!flight) return;
    const duration = reducedMotion
      ? REDUCED_FADE_MS + 50
      : FLY_DURATION_MS + 50;
    const timer = setTimeout(() => finishFlight(flight), duration);
    return () => clearTimeout(timer);
  }, [flight, reducedMotion, finishFlight]);

  const onTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!activeFlight) return;
      finishFlight(activeFlight);
    },
    [activeFlight, finishFlight],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || flight !== null || !card || e.button !== 0) return;
      tapRef.current = false;
      draggedRef.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
      dragOriginRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      setDragCardId(card.id);
      setDragThreshold(swipeDistanceThreshold(ref.current?.offsetWidth ?? 0));
      setDragOffset(0);
    },
    [disabled, flight, card],
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
      setDragCardId(null);

      if (disabled || flight !== null) {
        setDragOffset(0);
        return;
      }

      const dx = e.clientX - dragOriginRef.current.x;
      const dy = e.clientY - dragOriginRef.current.y;
      const elapsed = Date.now() - dragOriginRef.current.time;

      if (onTap && card && isTap(dx, dy, elapsed)) {
        tapRef.current = true;
        setDragOffset(0);
        return;
      }
      draggedRef.current = !isTap(dx, dy, elapsed);

      const width = ref.current?.offsetWidth ?? 320;
      const decision = decideSwipe(dx, width, elapsed);

      if (decision !== null && card) {
        startFlyOut(card, decision);
      } else {
        setDragOffset(0);
      }
    },
    [disabled, isDragging, flight, card, startFlyOut, onTap],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      pointerIdRef.current = null;
      tapRef.current = false;
      setDragCardId(null);
      setDragOffset(0);
    },
    [],
  );

  const onClick = useCallback(() => {
    if (!tapRef.current) return;
    tapRef.current = false;
    if (onTap && card && !disabled && flight === null) {
      onTap(card);
    }
  }, [onTap, card, disabled, flight]);

  const swipe = useCallback(
    (direction: SwipeDirection) => {
      if (disabled || flight !== null || !card) return;
      startFlyOut(card, direction);
    },
    [disabled, flight, card, startFlyOut],
  );

  const consumeDrag = useCallback(() => {
    const dragged = draggedRef.current;
    draggedRef.current = false;
    return dragged;
  }, []);

  const dragProgress = Math.min(1, Math.abs(dragOffset) / 120);

  const style = (pose: SwipePose): React.CSSProperties => {
    const rotationDeg = Math.max(-12, Math.min(12, (dragOffset / 280) * 12));
    let transform = pose(0, 0, reducedMotion);
    let transition =
      isDragging || reducedMotion
        ? "none"
        : `transform ${FLY_DURATION_MS}ms ${EASE_REVEAL}`;
    let opacity: number | undefined;

    if (activeFlight) {
      if (reducedMotion) {
        transition = `opacity ${REDUCED_FADE_MS}ms ${EASE_REVEAL}`;
        opacity = 0;
      } else {
        const flyX = activeFlight.direction === "right" ? "120vw" : "-120vw";
        const flyRot = activeFlight.direction === "right" ? 15 : -15;
        transform = `translate3d(${flyX}, 0, 0) rotate(${flyRot}deg)`;
      }
    } else if (isDragging && !reducedMotion) {
      // Reduced motion: the card stays put, the Vote/Skip tag still shows the direction.
      transform = pose(dragOffset, rotationDeg, false);
    }
    return { transform, transition, opacity };
  };

  let tag: SwipeGesture["tag"] = null;
  if (activeFlight) {
    tag = { direction: activeFlight.direction, opacity: 1 };
  } else if (isDragging && dragOffset !== 0) {
    tag = {
      direction: dragOffset > 0 ? "right" : "left",
      opacity: Math.min(1, Math.abs(dragOffset) / 90),
    };
  }

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

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
      onTransitionEnd,
    },
    swipe,
    busy: disabled || flight !== null,
    isDragging,
    progress: activeFlight !== null ? 1 : dragProgress,
    style,
    tag,
    glow: { side: glowSide, opacity: glowOpacity, transition: glowTransition },
    consumeDrag,
  };
}
