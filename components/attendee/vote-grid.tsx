import * as React from "react";
import { Heart } from "lucide-react";
import type { CategoryDto, PublicNomineeDto } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import type { PreviewPhoto } from "./photo-preview";
import { cn } from "@/lib/utils";

/**
 * Entries with a vote toggle per category (guide 17.12A). With one category
 * the toggle reads "Vote" or "Voted"; with several, each is named after its
 * category. Voted state is carried by the filled heart, the label and
 * aria-pressed, not by the border alone.
 */
export function VoteGrid({
  nominees,
  categories,
  hasVote,
  isPending,
  onToggle,
  onOpenPhoto,
}: {
  nominees: readonly PublicNomineeDto[];
  /** The categories to show a toggle for, in order. */
  categories: readonly CategoryDto[];
  hasVote: (categoryId: string, nomineeId: string) => boolean;
  isPending: (categoryId: string, nomineeId: string) => boolean;
  onToggle: (categoryId: string, nomineeId: string, vote: boolean) => void;
  onOpenPhoto: (photo: PreviewPhoto) => void;
}): React.JSX.Element {
  const named = categories.length > 1;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {nominees.map((nominee) => {
        const name = `${nominee.firstName} ${nominee.lastName}`;
        const votedAny = categories.some((category) =>
          hasVote(category.id, nominee.id)
        );
        return (
          <li
            key={nominee.id}
            className={cn(
              "flex flex-col overflow-hidden rounded-panel border-2 transition-colors duration-150 ease-reveal",
              votedAny ? "border-primary bg-accent/70" : "border-border bg-card"
            )}
          >
            <button
              type="button"
              aria-label={`See photo of ${name} larger`}
              onClick={() => onOpenPhoto({ url: nominee.photoUrl, name })}
              className="block w-full cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <img
                src={nominee.photoUrl}
                alt=""
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
              />
            </button>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <p className="truncate text-sm font-semibold">{name}</p>
              <div className="mt-auto flex flex-col gap-2">
                {categories.map((category) => {
                  const voted = hasVote(category.id, nominee.id);
                  const target = named ? `${name} in ${category.name}` : name;
                  return (
                    <Button
                      key={category.id}
                      type="button"
                      size={named ? "sm" : "default"}
                      variant={voted ? "secondary" : "outline"}
                      aria-pressed={voted}
                      aria-label={voted ? `Remove vote for ${target}` : `Vote for ${target}`}
                      disabled={isPending(category.id, nominee.id)}
                      onClick={() => onToggle(category.id, nominee.id, !voted)}
                      className={cn(
                        "w-full",
                        // A long category name wraps rather than spilling out.
                        named &&
                          "h-auto min-h-11 justify-start py-1.5 text-left leading-tight whitespace-normal compact:h-auto compact:min-h-8"
                      )}
                    >
                      <Heart fill={voted ? "currentColor" : "none"} />
                      {named ? category.name : voted ? "Voted" : "Vote"}
                    </Button>
                  );
                })}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
