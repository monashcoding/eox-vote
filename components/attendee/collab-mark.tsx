import * as React from "react";
import type { PublicSponsorDto } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/label";
import { MacLogo } from "@/components/ui/mac-logo";
import { SponsorLogo } from "@/components/ui/sponsor-logo";

/** The "×" between MAC and a partner; screen readers hear "and" instead. */
function Cross({ className }: { className?: string }): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true" className={cn("font-normal text-muted", className)}>
        ×
      </span>
      <span className="sr-only">and</span>
    </>
  );
}

/**
 * MAC's logo × the partner's logo, both in the same square box, with no names
 * written beside them, so each logo carries its society's name as alt text.
 */
export function CollabLogos({
  sponsor,
  size,
  className,
}: {
  sponsor: PublicSponsorDto;
  size: number;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={cn("flex items-center", className)}>
      <MacLogo size={size} />
      <Cross className="leading-none" />
      <SponsorLogo src={sponsor.logoUrl} size={size} alt={sponsor.name} />
    </span>
  );
}

/**
 * "MAC (logo) × (logo) CISSA": each society's name on the outside of its
 * logo, with the one "×" between the logos. The partner's short name is used,
 * or its full name when it has none; `nameClassName` lets a caller clamp or
 * truncate it. The logos are decorative, as the names are written out.
 */
export function CollabMark({
  sponsor,
  size,
  className,
  crossClassName,
  nameClassName,
}: {
  sponsor: PublicSponsorDto;
  size: number;
  className?: string;
  crossClassName?: string;
  nameClassName?: string;
}): React.JSX.Element {
  return (
    <Eyebrow className={cn("flex items-center", className)}>
      <span className="shrink-0">MAC</span>
      <MacLogo size={size} decorative />
      <Cross className={cn("leading-none", crossClassName)} />
      <SponsorLogo src={sponsor.logoUrl} size={size} alt="" />
      <span className={cn("min-w-0 text-left", nameClassName)}>
        {sponsor.shortName ?? sponsor.name}
      </span>
    </Eyebrow>
  );
}
