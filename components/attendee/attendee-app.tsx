"use client";

import * as React from "react";
import { PublicSessionDto, PublicStateDto, Stage } from "@/lib/api-types";
import { api } from "@/lib/client/api";
import { formatCountdownCopy, useCountdown } from "@/lib/client/use-countdown";
import { usePolling } from "@/lib/client/use-polling";
import { StagePill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">Voting is open.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Voting swipe deck will appear here soon.
          </p>
        </Card>
      );
    case Stage.Results:
      return (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">Results are underway.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Winners are being announced!
          </p>
        </Card>
      );
    case Stage.Finished:
      return (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold">Event finished.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for participating in Best Dressed!
          </p>
        </Card>
      );
    case Stage.Pending:
    default:
      return (
        <p className="text-muted-foreground">
          Waiting for host to start a session
        </p>
      );
  }
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
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Monash Association of Coding
        </p>
        <h1 className="mt-4 text-[clamp(2.75rem,12vw,5.5rem)] font-extrabold leading-none">
          Best Dressed
        </h1>
        <p className="mt-6 text-muted-foreground">
          Waiting for host to start a session
        </p>
      </main>
    );
  }

  const countdownCopy = formatCountdownCopy(session.stage, countdown);

  return (
    <main className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="mx-auto max-w-xl flex flex-col items-center text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Monash Association of Coding
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {session.name}
            </h1>
            <StagePill stage={session.stage} />
          </div>
          {countdownCopy && (
            <div className="text-sm font-medium text-muted-foreground">
              {countdownCopy}
            </div>
          )}
        </div>
      </header>

      <section className="flex-1 px-4 py-8 max-w-xl mx-auto w-full">
        <StageBody session={session} onChanged={fetchState} />
      </section>
    </main>
  );
}
