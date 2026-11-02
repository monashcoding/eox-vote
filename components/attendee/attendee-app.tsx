"use client";

import * as React from "react";
import { PublicSessionDto, PublicStateDto, Stage } from "@/lib/api-types";
import { api } from "@/lib/client/api";
import { formatCountdownCopy, useCountdown } from "@/lib/client/use-countdown";
import { cn } from "@/lib/utils";
import { usePolling } from "@/lib/client/use-polling";
import { StagePill } from "@/components/ui/badge";
import { EmptyState, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { NominatingView } from "./nominating-view";

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
      return (
        <EmptyState
          mascot={Mascot.ArmsUp}
          title="Voting is open"
          description="The swipe deck will appear here soon."
        />
      );
    case Stage.Results:
      return (
        <EmptyState
          mascot={Mascot.ArmsUp}
          title="Results are underway"
          description="Winners are being announced."
        />
      );
    case Stage.Finished:
      return (
        <EmptyState
          mascot={Mascot.ArmsUp}
          title="Event finished"
          description="Thanks for taking part in best dressed."
        />
      );
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

export function AttendeeApp(): React.JSX.Element {
  const [state, setState] = React.useState<PublicStateDto | null>(null);

  const fetchState = React.useCallback(async () => {
    try {
      const res = await api<PublicStateDto>("/api/state");
      setState(res);
    } catch (err: unknown) {
      console.error("Failed to fetch attendee state:", err);
    }
  }, []);

  const pollInterval = state?.session?.stage === Stage.Results ? 1000 : 2000;
  usePolling(fetchState, pollInterval);

  const session = state?.session;
  const countdown = useCountdown(session?.timer, state?.serverNow);

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
        <p className="mt-6 text-base text-muted md:text-sm">
          Waiting for host to start a session
        </p>
      </main>
    );
  }

  const countdownCopy = formatCountdownCopy(session.stage, countdown);

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b-2 border-border bg-card/95 px-4 py-5 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-xl flex-col items-center space-y-2 text-center">
          <Eyebrow>Monash Association of Coding</Eyebrow>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
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
        </div>
      </header>

      <section className="animate-rise-in mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <StageBody session={session} onChanged={fetchState} />
      </section>
    </main>
  );
}
