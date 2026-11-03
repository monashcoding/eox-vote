import * as React from "react";
import type { PublicSponsorDto } from "@/lib/api-types";
import { cn } from "@/lib/utils";
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
 * MAC's logo × the partner's logo, both in the same square box. `named`
 * means the names are written beside the logos, so the images are
 * decorative; otherwise each logo carries its society's name as alt text.
 */
export function CollabLogos({
  sponsor,
  size,
  named,
  className,
}: {
  sponsor: PublicSponsorDto;
  size: number;
  named: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={cn("flex items-center", className)}>
      <MacLogo size={size} decorative={named} />
      <Cross className="leading-none" />
      <SponsorLogo src={sponsor.logoUrl} size={size} alt={named ? "" : sponsor.name} />
    </span>
  );
}

/**
 * "MAC × CISSA": MAC's short name with the partner's short name, or its full
 * name when it has none.
 */
export function CollabShortName({
  sponsor,
}: {
  sponsor: PublicSponsorDto;
}): React.JSX.Element {
  return (
    <>
      MAC <Cross /> {sponsor.shortName ?? sponsor.name}
    </>
  );
}
