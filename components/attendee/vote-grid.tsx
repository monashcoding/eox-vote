import * as React from "react";
import { Heart } from "lucide-react";
import type { PublicNomineeDto } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Entries with a vote toggle each (guide 17.12A). Voted state is carried by
 * the check icon, the "Voted" label and aria-pressed, not by the border alone.
 */
export function VoteGrid({
  nominees,
  votedIds,
  pendingIds,
  onToggle,
}: {
  nominees: readonly PublicNomineeDto[];
  votedIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  onToggle: (nomineeId: string, vote: boolean) => void;
}): React.JSX.Element {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {nominees.map((nominee) => {
        const voted = votedIds.has(nominee.id);
        const name = `${nominee.firstName} ${nominee.lastName}`;
        return (
          <li
            key={nominee.id}
            className={cn(
              "flex flex-col overflow-hidden rounded-panel border-2 transition-colors duration-150 ease-reveal",
              voted ? "border-primary bg-accent/70" : "border-border bg-card"
            )}
          >
            <img
              src={nominee.photoUrl}
              alt={name}
              loading="lazy"
              className="aspect-[3/4] w-full object-cover"
            />
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="truncate text-sm font-semibold">{name}</p>
              <Button
                type="button"
                variant={voted ? "secondary" : "outline"}
                aria-pressed={voted}
                aria-label={voted ? `Remove vote for ${name}` : `Vote for ${name}`}
                disabled={pendingIds.has(nominee.id)}
                onClick={() => onToggle(nominee.id, !voted)}
                className="mt-auto w-full"
              >
                <Heart fill={voted ? "currentColor" : "none"} />
                {voted ? "Voted" : "Vote"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
