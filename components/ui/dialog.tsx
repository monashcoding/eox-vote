"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

/*
 * Base UI dialog parts with the guide's overlay (17.6). Base UI handles the
 * focus trap, Escape, scroll lock and returning focus on close.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogTitle = DialogPrimitive.Title;
export const DialogClose = DialogPrimitive.Close;

export function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props): React.JSX.Element {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-reveal data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}

export function DialogPopup({
  className,
  ...props
}: DialogPrimitive.Popup.Props): React.JSX.Element {
  return (
    <DialogPrimitive.Popup
      className={cn(
        "fixed z-50 outline-none transition-opacity duration-200 ease-reveal data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
        className
      )}
      {...props}
    />
  );
}
