"use client";

import * as React from "react";
import { PublicSessionDto, PublicStateDto, Stage } from "@/lib/api-types";
import { api } from "@/lib/client/api";
import { formatCountdownCopy, useCountdown } from "@/lib/client/use-countdown";
import { cn } from "@/lib/utils";
import { usePolling } from "@/lib/client/use-polling";
import { StagePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
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
      console.error("Failed to fetch attendee state:", err);
      setOffline(true);
    }
  }, []);

  const pollInterval = state?.session?.stage === Stage.Results ? 1000 : 2000;
  usePolling(fetchState, pollInterval);

  const session = state?.session;
  const countdown = useCountdown(session?.timer, state?.serverNow);

  if (!state && offline) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6">
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
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center sm:px-6">
        <Eyebrow>Monash Association of Coding</Eyebrow>
        <h1 className="mt-4 text-[clamp(2.5rem,5.5vw+1.25rem,4.5rem)] leading-none font-extrabold tracking-tight">
          Best{" "}
          <span className="inline-block rounded-tag bg-primary px-2 py-0.5 text-primary-foreground">
            dressed
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
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b-2 border-border bg-card/95 px-4 py-5 backdrop-blur-xl sm:px-6 short:py-2">
        <div className="mx-auto flex max-w-xl flex-col items-center space-y-2 text-center short:space-y-0.5">
          <Eyebrow className="short:hidden">Monash Association of Coding</Eyebrow>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl short:text-xl">
              {session.name}
            </h1>
            <StagePill stage={session.stage} />
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
          {offline && <OfflineNote />}
        </div>
      </header>

      <section className="animate-rise-in mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8 short:py-3">
        <StageBody session={session} onChanged={fetchState} />
      </section>
    </main>
  );
}
