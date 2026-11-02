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

export type PreviewPhoto = { url: string; name: string };

/**
 * A nominee's photo as large as the screen allows, with the name under it.
 * Closes on the X, a tap anywhere around the photo, or Escape. The parent keeps
 * `photo` set while `open` goes false so the photo stays during the fade out.
 */
export function PhotoPreview({
  photo,
  open,
  onOpenChange,
}: {
  photo: PreviewPhoto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open && photo !== null} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop className="bg-black/90" />
        <DialogPopup
          className="safe-t safe-b safe-x inset-0 flex flex-col"
          // The popup fills the screen, so "outside" is any tap that misses
          // the photo, its name and the X.
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("[data-preview-keep]")) {
              onOpenChange(false);
            }
          }}
        >
          <div className="flex shrink-0 justify-end p-2">
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
              <img
                data-preview-keep
                src={photo.url}
                alt={photo.name}
                draggable={false}
                className="min-h-0 max-w-full rounded-panel object-contain transition-transform duration-200 ease-reveal motion-safe:in-data-[starting-style]:scale-95 motion-safe:in-data-[ending-style]:scale-95"
              />
              <DialogTitle
                render={<figcaption />}
                data-preview-keep
                className="max-w-full shrink-0 truncate text-center text-base font-semibold text-white"
              >
                {photo.name}
              </DialogTitle>
            </figure>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
