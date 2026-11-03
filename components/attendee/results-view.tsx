"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import {
  PodiumPlaceDto,
  PublicResultsDto,
  PublicSessionDto,
  Stage,
} from "@/lib/api-types";
import { placeLabel } from "@/lib/place-label";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { EmptyState, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { MacLogo } from "@/components/ui/mac-logo";
import { CollabLogos } from "./collab-mark";

const WINNER_PLACE = 1;

/** Confetti particles: horizontal position (%), start delay (ms), colour token. */
const CONFETTI = [
  { left: 8, delay: 0, tone: "bg-primary" },
  { left: 18, delay: 120, tone: "bg-foreground" },
  { left: 28, delay: 40, tone: "bg-primary" },
  { left: 38, delay: 200, tone: "bg-info" },
  { left: 48, delay: 80, tone: "bg-primary" },
  { left: 58, delay: 160, tone: "bg-success" },
  { left: 68, delay: 20, tone: "bg-primary" },
  { left: 78, delay: 140, tone: "bg-foreground" },
  { left: 88, delay: 60, tone: "bg-primary" },
  { left: 94, delay: 180, tone: "bg-live" },
] as const;

function Confetti(): React.JSX.Element {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-4 h-0 motion-reduce:hidden"
    >
      {CONFETTI.map((particle) => (
        <span
          key={particle.left}
          className={cn(
            "animate-winner-confetti absolute top-0 block h-3 w-1.5 rounded-tag opacity-0",
            particle.tone
          )}
          style={{ left: `${particle.left}%`, animationDelay: `${particle.delay}ms` }}
        />
      ))}
    </div>
  );
}

function Votes({ count }: { count: number }): React.JSX.Element {
  return (
    <p className="text-sm text-muted">
      <span className="inline-block min-w-[2ch] text-right text-base font-semibold tabular-nums text-foreground">
        {count}
      </span>{" "}
      {count === 1 ? "vote" : "votes"}
    </p>
  );
}

function PlaceCard({
  group,
  animate,
}: {
  group: PodiumPlaceDto;
  /** Play the entrance (and winner confetti) for places revealed while watching. */
  animate: boolean;
}): React.JSX.Element {
  const isWinner = group.place === WINNER_PLACE;
  const joint = group.nominees.length > 1;
  const label = placeLabel(group);

  return (
    <Card
      className={cn(
        "relative text-center",
        animate && "animate-rise-in motion-reduce:transform-none",
        isWinner && "border-primary"
      )}
    >
      {isWinner && animate && <Confetti />}
      <div className="flex items-center justify-center gap-2">
        {isWinner && <Trophy className="size-5 text-primary" aria-hidden />}
        {isWinner ? (
          <h2 className="inline-block rounded-tag bg-primary px-1.5 py-0.5 text-lg font-bold text-primary-foreground">
            {label}
          </h2>
        ) : (
          <h2 className="text-lg font-semibold">
            <Eyebrow className="text-sm">{label}</Eyebrow>
          </h2>
        )}
      </div>

      <ul
        className={cn(
          "mt-4 grid gap-4",
          joint ? "grid-cols-2" : "grid-cols-1 justify-items-center"
        )}
      >
        {group.nominees.map((nominee) => (
          <li
            key={nominee.id}
            className={cn("min-w-0", !joint && "w-full max-w-xs")}
          >
            <img
              src={nominee.photoUrl}
              alt={`Costume photo of ${nominee.firstName} ${nominee.lastName}`}
              className="aspect-square w-full rounded-panel border-2 border-border object-cover"
            />
            <p
              className={cn(
                "mt-3 break-words font-semibold",
                isWinner ? "text-xl" : "text-base"
              )}
            >
              {nominee.firstName} {nominee.lastName}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-2">
        <Votes count={group.votes} />
        {joint && (
          <p className="text-xs text-muted">Each with this many votes</p>
        )}
      </div>
    </Card>
  );
}

export function ResultsView({
  session,
}: {
  session: PublicSessionDto;
}): React.JSX.Element {
  const results: PublicResultsDto = session.results ?? {
    totalSteps: 0,
    revealed: [],
  };
  const finished = session.stage === Stage.Finished;
  // Places already on screen at first render appear without the entrance.
  const [initialCount] = React.useState(results.revealed.length);

  if (results.totalSteps === 0) {
    return (
      <EmptyState
        mascot={Mascot.Sad}
        title="No votes were cast"
        description="There is no podium to show for this session."
      />
    );
  }

  const waiting = results.revealed.length < results.totalSteps;
  // Revealed places arrive lowest first; show the newest at the top.
  const shown = results.revealed.toReversed();

  return (
    <div className="space-y-4">
      {waiting && (
        <EmptyState
          mascot={results.revealed.length === 0 ? Mascot.Wave : undefined}
          title="Waiting for the next place"
          description={
            results.revealed.length === 0
              ? "The host will reveal the top three one place at a time."
              : undefined
          }
          className={cn(results.revealed.length > 0 && "p-5 md:p-6")}
        />
      )}

      <div aria-live="polite" className="space-y-4">
        {shown.map((group) => (
          <PlaceCard
            key={group.place}
            group={group}
            animate={
              !finished &&
              results.revealed.indexOf(group) >= initialCount
            }
          />
        ))}
      </div>

      {finished && (
        <div className="flex flex-col items-center gap-3 pt-2">
          {session.sponsor ? (
            // No names here, so each logo carries its society's name.
            <CollabLogos
              sponsor={session.sponsor}
              size={48}
              named={false}
              className="gap-2.5 text-lg"
            />
          ) : (
            <MacLogo size={48} decorative />
          )}
          <p className="text-center text-base font-semibold">
            Thanks for voting!
          </p>
        </div>
      )}
    </div>
  );
}
