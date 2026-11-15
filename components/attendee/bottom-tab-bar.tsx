import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Holds an attendee screen's tab bar, which sits below the content so it never
 * takes height from the photos (guide 17.8). Under the swipe deck it ends the
 * one-screen column, above the shell's safe-area padding. Over a scrolling
 * list (`sticky`) it sticks to the bottom of the screen; its padding covers
 * the safe area there and the matching negative margin keeps the in-flow
 * spacing unchanged.
 */
export function BottomTabBar({
  sticky,
  children,
}: {
  sticky: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "mt-4 sm:mt-6 short:mt-3",
        sticky &&
          "sticky bottom-0 z-20 -mb-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)] bg-background pt-3 pb-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)]"
      )}
    >
      {children}
    </div>
  );
}
