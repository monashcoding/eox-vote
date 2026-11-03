"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Heart, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SwipeDirection } from "@/lib/client/swipe-decision";
import { cn } from "@/lib/utils";
import type { SwipeGesture } from "./use-swipe-gesture";

/* The glow portal needs document.body, so it renders after hydration only. */
function subscribeNever(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Vote or Skip tag on a card being swiped: icon + word, never colour alone.
 * Place it in a `relative` parent; Vote sits top left, Skip top right.
 */
export function SwipeTag({
  tag,
}: {
  tag: SwipeGesture["tag"];
}): React.JSX.Element | null {
  if (!tag) return null;
  if (tag.direction === "right") {
    return (
      <div
        className="pointer-events-none absolute top-3 left-3 rounded-tag bg-card select-none"
        style={{ opacity: tag.opacity }}
      >
        <Badge variant="success" tag className="border-0">
          <Heart aria-hidden fill="currentColor" />
          Vote
        </Badge>
      </div>
    );
  }
  return (
    <div
      className="pointer-events-none absolute top-3 right-3 rounded-control bg-card select-none"
      style={{ opacity: tag.opacity }}
    >
      <Badge variant="outline" tag className="border-0">
        <X aria-hidden />
        Skip
      </Badge>
    </div>
  );
}

/**
 * Red (left) or green (right) edge glow. Portalled to <body> so it is never
 * trapped inside a size container; `className` lifts it over a dialog.
 */
export function SwipeGlow({
  glow,
  className,
}: {
  glow: SwipeGesture["glow"];
  className?: string;
}): React.JSX.Element | null {
  const isClient = useSyncExternalStore(
    subscribeNever,
    getClientSnapshot,
    getServerSnapshot,
  );
  if (!isClient) return null;
  return createPortal(
    <>
      <div
        aria-hidden
        data-swipe-glow="left"
        className={cn(
          "pointer-events-none fixed inset-y-0 left-0 z-50 w-[calc(7.5rem+env(safe-area-inset-left,0px))] bg-linear-to-r from-danger/45 to-transparent",
          className,
        )}
        style={{
          opacity: glow.side === "left" ? glow.opacity : 0,
          transition: glow.transition,
        }}
      />
      <div
        aria-hidden
        data-swipe-glow="right"
        className={cn(
          "pointer-events-none fixed inset-y-0 right-0 z-50 w-[calc(7.5rem+env(safe-area-inset-right,0px))] bg-linear-to-l from-success/45 to-transparent",
          className,
        )}
        style={{
          opacity: glow.side === "right" ? glow.opacity : 0,
          transition: glow.transition,
        }}
      />
    </>,
    document.body,
  );
}

/** Skip (X) and Vote (heart): the same actions as the gestures. */
export function SwipeButtons({
  onSwipe,
  disabled,
  className,
}: {
  onSwipe: (direction: SwipeDirection) => void;
  disabled: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("flex items-center gap-6", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Skip"
        disabled={disabled}
        onClick={() => onSwipe("left")}
        className="size-14 compact:size-11"
      >
        <X className="size-6" />
      </Button>
      <Button
        type="button"
        size="icon"
        aria-label="Vote"
        disabled={disabled}
        onClick={() => onSwipe("right")}
        className="size-14 compact:size-11"
      >
        <Heart className="size-6" fill="currentColor" />
      </Button>
    </div>
  );
}
