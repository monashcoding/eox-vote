import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A partner society's logo in the same square box as `MacLogo` of the same
 * size. Wide or tall logos are contained in the box, never stretched. Pass
 * `alt=""` where the sponsor's name is already shown beside it.
 */
export function SponsorLogo({
  src,
  size,
  alt,
  className,
}: {
  src: string;
  size: number;
  alt: string;
  className?: string;
}): React.JSX.Element {
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      // Inline size: preflight's `height: auto` would otherwise shrink the
      // box to a wide logo's aspect ratio.
      style={{ width: size, height: size }}
      className={cn("shrink-0 object-contain select-none", className)}
    />
  );
}
