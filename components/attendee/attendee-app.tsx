"use client";

import * as React from "react";
import { PublicSessionDto, PublicStateDto, Stage } from "@/lib/api-types";
import { api } from "@/lib/client/api";
import { errorMessage } from "@/lib/client/error-message";
import { formatCountdownCopy, useCountdown } from "@/lib/client/use-countdown";
import { cn } from "@/lib/utils";
import { usePolling } from "@/lib/client/use-polling";
import { StagePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { MacLogo } from "@/components/ui/mac-logo";
import { NominatingView } from "./nominating-view";
import { ResultsView } from "./results-view";
import { VotingView } from "./voting-view";

export function StageBody({
  session,
  onChanged,
}: {
  session: PublicSessionDto;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  switch (session.stage) {
    case Stage.Nominating:
      return (
        <NominatingView key={session.id} session={session} onChanged={onChanged} />
      );
    case Stage.Voting:
      return <VotingView key={session.id} session={session} onChanged={onChanged} />;
    case Stage.Results:
    case Stage.Finished:
      return <ResultsView key={session.id} session={session} />;
    case Stage.Pending:
    default:
      return (
        <p className="text-muted">Waiting for host to start a session</p>
      );
  }
}

/** Renders countdown copy with the time in the live-numeral recipe (guide 4.4). */
function CountdownText({
  copy,
  formatted,
}: {
  copy: string;
  formatted: string;
}): React.JSX.Element {
  const at = formatted ? copy.indexOf(formatted) : -1;
  if (at < 0) return <>{copy}</>;
  return (
    <>
      {copy.slice(0, at)}
      <span className="inline-block min-w-[5ch] text-right font-semibold tabular-nums text-foreground">
        {formatted}
      </span>
      {copy.slice(at + formatted.length)}
    </>
  );
}

/** Small note shown while a poll fails but the last good state is still on screen. */
function OfflineNote(): React.JSX.Element {
  return (
    <p role="status" className="text-sm font-medium text-danger">
      Can&apos;t reach the server. Retrying…
    </p>
  );
}

export function AttendeeApp(): React.JSX.Element {
  const [state, setState] = React.useState<PublicStateDto | null>(null);
  const [offline, setOffline] = React.useState(false);

  const fetchState = React.useCallback(async () => {
    try {
      const res = await api<PublicStateDto>("/api/state");
      setState(res);
      setOffline(false);
    } catch (err: unknown) {
      console.error("Failed to fetch attendee state:", errorMessage(err, String(err)));
      setOffline(true);
    }
  }, []);

  const pollInterval = state?.session?.stage === Stage.Results ? 1000 : 2000;
  usePolling(fetchState, pollInterval);

  const session = state?.session;
  const countdown = useCountdown(session?.timer, state?.serverNow);

  if (!state && offline) {
    return (
      <main className="safe-t safe-b flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6">
        <EmptyState
          as="h1"
          mascot={Mascot.Sad}
          title="Could not reach the server"
          description="Check your connection. We will keep trying in the background."
          action={
            <Button
              type="button"
              variant="secondary"
              className="w-full md:w-auto"
              onClick={() => void fetchState()}
            >
              Try again
            </Button>
          }
          className="w-full max-w-md"
        />
      </main>
    );
  }

  if (!session || session.stage === Stage.Pending) {
    return (
      <main className="safe-t safe-b flex min-h-dvh flex-col items-center justify-center overflow-x-clip px-4 text-center sm:px-6">
        <MacLogo size={64} decorative className="mb-4" />
        <Eyebrow>Monash Association of Coding</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.5rem,5.5vw+1.25rem,4.5rem)] leading-none font-extrabold tracking-tight">
          <span className="block">EOX 2026</span>{" "}
          <span className="mt-4 block">
            Best{" "}
            <span className="relative isolate inline-block">
              {/* Min peeks over the top edge of the highlight from behind it. */}
              <img
                src="/mascots/min-artist.svg"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="pointer-events-none absolute -right-[0.15em] bottom-[calc(100%_-_0.25em)] -z-10 w-[1.55em] max-w-none rotate-15 select-none"
              />
              {/* A ring in the page colour outlines the box where it covers Min. */}
              <span className="inline-block rounded-tag bg-primary px-2 py-0.5 text-primary-foreground ring-4 ring-background">
                Dressed
              </span>
            </span>
          </span>
        </h1>
        <p className="mt-6 text-base text-muted compact:text-sm">
          Waiting for host to start a session
        </p>
        {offline && (
          <div className="mt-3">
            <OfflineNote />
          </div>
        )}
      </main>
    );
  }

  const countdownCopy = formatCountdownCopy(session.stage, countdown);

  return (
    // While the swipe deck shows, the shell is exactly one screen tall: the
    // deck sizes its card from the height left over, which needs a definite
    // height all the way down (taller content still scrolls past it).
    <main className="safe-t safe-b flex min-h-dvh flex-col bg-background text-foreground has-[[data-swipe-deck]]:h-dvh">
      {/* Above the section (which has its own stacking context) so the offline note can overhang it. */}
      <header className="relative z-10 border-b-2 border-border bg-card/95 px-4 py-4 backdrop-blur-xl sm:px-6 sm:py-5 short:py-2">
        <div className="mx-auto flex max-w-xl flex-col items-center space-y-2 text-center short:space-y-0.5">
          <div className="flex items-center gap-2 short:hidden">
            <MacLogo size={24} decorative />
            <Eyebrow>Monash Association of Coding</Eyebrow>
          </div>
          {/* The pill stays beside the title and long names are clamped, so
              the voting deck keeps its room on small screens. */}
          <div className="flex max-w-full items-center justify-center gap-3">
            <h1 className="line-clamp-2 min-w-0 text-2xl leading-tight font-semibold tracking-tight wrap-break-word sm:text-3xl short:line-clamp-1 short:text-xl">
              {session.name}
            </h1>
            <StagePill stage={session.stage} showLiveDot={false} className="shrink-0" />
          </div>
          {countdownCopy && (
            <p
              className={cn(
                "text-sm font-medium",
                countdown.isExpired ? "text-live" : "text-muted"
              )}
            >
              <CountdownText copy={countdownCopy} formatted={countdown.formatted} />
            </p>
          )}
        </div>
        {/*
          Takes no space: it straddles the header's bottom edge, over the
          padding on either side, so appearing and clearing never moves the
          voting deck. Always mounted so screen readers hear it appear.
        */}
        <div role="status" className="pointer-events-none absolute inset-x-0 top-full h-0 px-4">
          {offline && (
            <p className="mx-auto w-fit max-w-full -translate-y-1/2 rounded-control border-2 border-danger/50 bg-card px-3 py-1 text-sm font-medium text-danger short:py-0 short:text-xs">
              Can&apos;t reach the server. Retrying…
            </p>
          )}
        </div>
      </header>

      {/* A flex column, so the swipe deck can fill the height left under the header. */}
      <section className="animate-rise-in mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 short:py-3">
        <StageBody session={session} onChanged={fetchState} />
      </section>
    </main>
  );
}
