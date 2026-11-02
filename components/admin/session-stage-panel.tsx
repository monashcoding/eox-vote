"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Pause, Play, Square, Timer } from "lucide-react";
import {
  AdminSessionDetailDto,
  ControlAction,
  ControlRequest,
  Stage,
} from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { useCountdown } from "@/lib/client/use-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Eyebrow, Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SessionStagePanelProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

const STAGES = [
  { key: Stage.Pending, label: "Pending" },
  { key: Stage.Nominating, label: "Nominating" },
  { key: Stage.Voting, label: "Voting" },
  { key: Stage.Results, label: "Results" },
  { key: Stage.Finished, label: "Finished" },
];

function getNextActionLabel(stage: Stage): string | null {
  switch (stage) {
    case Stage.Pending:
      return "Open nominations";
    case Stage.Nominating:
      return "Open voting";
    case Stage.Voting:
      return "Show results";
    case Stage.Results:
      return "Finish session";
    case Stage.Finished:
      return null;
  }
}

function getPreviousActionLabel(stage: Stage): string | null {
  switch (stage) {
    case Stage.Finished:
      return "Back to results";
    case Stage.Results:
      return "Back to voting";
    case Stage.Voting:
      return "Back to nominating";
    case Stage.Nominating:
      return "Back to pending";
    case Stage.Pending:
      return null;
  }
}

export function SessionStagePanel({
  session,
  onRefresh,
}: SessionStagePanelProps): React.JSX.Element {
  const countdown = useCountdown(session.timer, session.serverNow);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = React.useState<number>(
    session.stage === Stage.Nominating
      ? session.nominatingMinutes || 30
      : session.votingMinutes || 45
  );
  const [customEndTime, setCustomEndTime] = React.useState<string>("");

  const nextLabel = getNextActionLabel(session.stage);
  const prevLabel = getPreviousActionLabel(session.stage);
  const isTimed =
    session.stage === Stage.Nominating || session.stage === Stage.Voting;

  const currentStageIndex = STAGES.findIndex((s) => s.key === session.stage);

  const sendControl = async (request: ControlRequest) => {
    setLoading(true);
    setError(null);
    try {
      await api<AdminSessionDetailDto>(
        `/api/admin/sessions/${session.id}/control`,
        {
          method: "POST",
          body: JSON.stringify(request),
        }
      );
      await onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!nextLabel || loading) return;
    const confirmed = window.confirm(
      `Are you sure you want to ${nextLabel.toLowerCase()}?`
    );
    if (!confirmed) return;
    await sendControl({
      action: ControlAction.Next,
      expectedStage: session.stage,
    });
  };

  const handlePrevious = async () => {
    if (!prevLabel || loading) return;
    const confirmed = window.confirm(
      `Are you sure you want to go ${prevLabel.toLowerCase()}?`
    );
    if (!confirmed) return;
    await sendControl({
      action: ControlAction.Previous,
      expectedStage: session.stage,
    });
  };

  const handleToggleAutoAdvance = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const checked = e.target.checked;
    setLoading(true);
    setError(null);
    try {
      await api<AdminSessionDetailDto>(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ autoAdvance: checked }),
      });
      await onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not update auto-advance");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMinutes || customMinutes <= 0 || customMinutes > 600 || loading) {
      return;
    }
    await sendControl({
      action: ControlAction.SetTimer,
      durationMs: customMinutes * 60 * 1000,
    });
  };

  const handleSetEndTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEndTime || loading) return;
    const [h, m] = customEndTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;

    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }

    await sendControl({
      action: ControlAction.SetTimer,
      endsAt: target.getTime(),
    });
  };

  return (
    <Card className="space-y-6">
      <CardHeader className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg sm:text-xl">Stage and timer</CardTitle>
          <p className="text-sm text-muted">
            Control the event stage and its countdown.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {prevLabel && (
            <Button variant="outline" disabled={loading} onClick={handlePrevious}>
              <ArrowLeft />
              {prevLabel}
            </Button>
          )}
          {nextLabel && (
            <Button size="lg" disabled={loading} onClick={handleNext}>
              {nextLabel}
              <ArrowRight />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <ErrorNote message={error} />

        <div>
          <Eyebrow className="mb-3 block">Event progress</Eyebrow>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STAGES.map((s, idx) => {
              const isCurrent = s.key === session.stage;
              const isPast = idx < currentStageIndex;
              return (
                <li
                  key={s.key}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-control border-2 p-3 text-sm transition-colors duration-150",
                    isCurrent
                      ? "border-primary bg-accent/70 font-semibold text-foreground"
                      : isPast
                        ? "border-border bg-surface-soft text-foreground"
                        : "border-border bg-surface-soft/40 text-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isPast
                          ? "bg-accent text-foreground"
                          : "border-2 border-border text-muted"
                    )}
                  >
                    {isPast ? <Check className="size-3.5" /> : idx + 1}
                  </span>
                  <span className="truncate">{s.label}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-6 rounded-panel border-2 border-border bg-surface-soft p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Eyebrow>Stage countdown</Eyebrow>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <div
                  className={cn(
                    "inline-block min-w-[5ch] text-right text-5xl font-bold tracking-tight tabular-nums sm:text-6xl",
                    countdown.isExpired
                      ? "text-live"
                      : countdown.hasTimer
                        ? "text-foreground"
                        : "text-disabled"
                  )}
                >
                  {countdown.formatted || "--:--"}
                </div>
                <div>
                  {countdown.status === "running" && (
                    <Badge variant="live" tag>
                      <span
                        aria-hidden
                        className="size-1.5 animate-pulse rounded-full bg-live motion-reduce:animate-none"
                      />
                      Running
                    </Badge>
                  )}
                  {countdown.status === "paused" && (
                    <Badge variant="outline" tag>
                      <Pause />
                      Paused
                    </Badge>
                  )}
                  {countdown.status === "expired" && (
                    <Badge variant="danger" tag>
                      Time is up
                    </Badge>
                  )}
                  {countdown.status === "none" && (
                    <Badge variant="outline" tag>
                      No timer
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border-2 border-border bg-card px-3 text-sm font-medium text-foreground transition-colors select-none hover:border-border-strong md:min-h-9">
              <input
                type="checkbox"
                checked={session.autoAdvance}
                onChange={handleToggleAutoAdvance}
                disabled={loading}
                className="size-5 cursor-pointer accent-primary md:size-4"
              />
              Auto-advance on expiry
            </label>
          </div>

          {isTimed ? (
            <div className="space-y-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {countdown.isRunning ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => sendControl({ action: ControlAction.Pause })}
                  >
                    <Pause />
                    Pause
                  </Button>
                ) : countdown.isPaused ? (
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={() => sendControl({ action: ControlAction.Resume })}
                  >
                    <Play />
                    Resume
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <Pause />
                    Pause
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() => sendControl({ action: ControlAction.ClearTimer })}
                >
                  <Square />
                  Stop timer
                </Button>

                <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() =>
                    sendControl({ action: ControlAction.AdjustTimer, deltaMs: -5 * 60 * 1000 })
                  }
                >
                  -5m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() =>
                    sendControl({ action: ControlAction.AdjustTimer, deltaMs: -1 * 60 * 1000 })
                  }
                >
                  -1m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    sendControl({ action: ControlAction.AdjustTimer, deltaMs: 1 * 60 * 1000 })
                  }
                >
                  +1m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    sendControl({ action: ControlAction.AdjustTimer, deltaMs: 5 * 60 * 1000 })
                  }
                >
                  +5m
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                <form onSubmit={handleSetMinutes} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="set-duration">Set duration (minutes)</Label>
                    <Input
                      id="set-duration"
                      type="number"
                      min={1}
                      max={600}
                      value={customMinutes}
                      onChange={(e) =>
                        setCustomMinutes(parseInt(e.target.value, 10) || 0)
                      }
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={loading || customMinutes <= 0}
                  >
                    <Timer />
                    Set
                  </Button>
                </form>

                <form onSubmit={handleSetEndTime} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="set-end-time">Set end time (local)</Label>
                    <Input
                      id="set-end-time"
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={loading || !customEndTime}
                  >
                    <Timer />
                    Set end
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <p className="border-t border-border pt-4 text-xs text-muted">
              Timer controls are only available during the nominating and voting stages.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
