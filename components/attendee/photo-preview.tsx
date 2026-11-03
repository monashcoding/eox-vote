"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SwipeDirection } from "@/lib/client/swipe-decision";
import { ErrorNote } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { SwipeButtons, SwipeGlow, SwipeTag } from "./swipe-feedback";
import { useSwipeGesture } from "./use-swipe-gesture";

export type PreviewPhoto = { url: string; name: string };

/**
 * Makes the preview a full size swipe card: `id` names the card handed back
 * to `onSwipe` once it has flown out.
 */
export type PreviewSwipe = {
  id: string;
  onSwipe: (id: string, direction: SwipeDirection) => void;
};

/**
 * A nominee's photo as large as the screen allows, with the name under it.
 * Closes on the X, a tap anywhere around the photo, or Escape. The parent keeps
 * `photo` set while `open` goes false so the photo stays during the fade out.
 *
 * With `swipe` the photo is swiped like the deck's top card (same thresholds,
 * tags and edge glow, lifted over the backdrop), with Skip and Vote under it.
 * Without it the preview is view only. `error` (a vote that did not save) is
 * floated over the top, as the deck's own note is hidden behind the preview.
 */
export function PhotoPreview({
  photo,
  open,
  onOpenChange,
  swipe,
  error,
}: {
  photo: PreviewPhoto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swipe?: PreviewSwipe;
  error?: string | null;
}): React.JSX.Element {
  // The swipe UI stays up while the preview fades out, so the layout does not
  // jump; only the gesture is switched off once `open` is false. Keyed by id,
  // so the gesture keeps its flight while the parent re-renders.
  const swipeId = swipe ? swipe.id : null;
  const swipeCard = React.useMemo(
    () => (swipeId ? { id: swipeId } : null),
    [swipeId]
  );
  const onSwipe = swipe?.onSwipe;
  const handleSwipe = React.useCallback(
    (card: { id: string }, direction: SwipeDirection) =>
      onSwipe?.(card.id, direction),
    [onSwipe]
  );
  const {
    ref: dragRef,
    handlers,
    style,
    tag,
    swipe: swipeTo,
    busy,
    glow,
    consumeDrag,
  } = useSwipeGesture({
    card: swipeCard,
    onSwipe: handleSwipe,
    disabled: !open || !swipeCard,
  });

  return (
    <Dialog open={open && photo !== null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop className="bg-black/90" />
        <DialogPopup
          className="safe-t safe-b safe-x inset-0 flex flex-col"
          // The popup fills the screen, so "outside" is any tap that misses
          // the photo, its name, the X and the buttons. The click that ends a
          // mouse drag is not a tap; a new press clears a drag that a touch
          // ended without a click.
          onPointerDownCapture={() => void consumeDrag()}
          onClick={(e) => {
            if (consumeDrag()) return;
            if (!(e.target as HTMLElement).closest("[data-preview-keep]")) {
              onOpenChange(false);
            }
          }}
        >
          <div className="relative flex shrink-0 justify-end p-2">
            {/* Floats over the photo's top, so it never moves the photo. */}
            {swipeCard && error && (
              <div
                data-preview-keep
                className="absolute top-2 right-16 left-2 z-10 rounded-control bg-background"
              >
                <ErrorNote message={error} />
              </div>
            )}
            <DialogClose
              data-preview-keep
              aria-label="Close photo"
              className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 ease-reveal outline-none hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-ring compact:size-9"
            >
              <X className="size-6 compact:size-5" />
            </DialogClose>
          </div>
          {photo && (
            <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
              {swipeCard ? (
                <div
                  key={swipeCard.id}
                  data-preview-keep
                  ref={dragRef}
                  {...handlers}
                  style={{
                    ...style(
                      (dragX, dragRotate) =>
                        `translate3d(${dragX}px, 0, 0) rotate(${dragRotate}deg)`
                    ),
                    // Nothing scrolls behind the full-screen preview, so every
                    // drag is a swipe. With pan-y (as on the deck, where the
                    // page can scroll), one that starts a little downward goes
                    // to the browser and is cancelled.
                    touchAction: "none",
                    willChange: "transform, opacity",
                  }}
                  className="relative flex min-h-0 max-w-full cursor-grab select-none active:cursor-grabbing"
                >
                  {/* The surface takes the pointer, as the deck's cards do. */}
                  <PreviewImage photo={photo} className="pointer-events-none" />
                  <SwipeTag tag={tag} />
                </div>
              ) : (
                <PreviewImage photo={photo} />
              )}
              <DialogTitle
                render={<figcaption />}
                data-preview-keep
                className="max-w-full shrink-0 truncate text-center text-base font-semibold text-white"
              >
                {photo.name}
              </DialogTitle>
              {swipeCard && (
                <div data-preview-keep className="shrink-0">
                  <SwipeButtons onSwipe={swipeTo} disabled={busy} />
                </div>
              )}
            </figure>
          )}
        </DialogPopup>
      </DialogPortal>
      {/* Over the backdrop and the popup (both z-50) while the photo is swiped. */}
      {open && swipeCard && <SwipeGlow glow={glow} className="z-[60]" />}
    </Dialog>
  );
}

function PreviewImage({
  photo,
  className,
}: {
  photo: PreviewPhoto;
  className?: string;
}): React.JSX.Element {
  return (
    <img
      data-preview-keep
      src={photo.url}
      alt={photo.name}
      draggable={false}
      className={cn(
        "min-h-0 max-w-full rounded-panel object-contain transition-transform duration-200 ease-reveal motion-safe:in-data-[starting-style]:scale-95 motion-safe:in-data-[ending-style]:scale-95",
        className
      )}
    />
  );
}
