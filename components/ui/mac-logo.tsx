import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * MAC's round brand logo (guide 7.1, `public/mac.svg`). Pass `decorative`
 * where the text beside it already names MAC, so screen readers skip it.
 */
export function MacLogo({
  size = 40,
  decorative = false,
  className,
}: {
  size?: number;
  decorative?: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <img
      src="/mac.svg"
      width={size}
      height={size}
      alt={decorative ? "" : "Monash Association of Coding"}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn("shrink-0 rounded-full select-none", className)}
    />
  );
}
