"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Pause, Play, Square, Timer } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
    await sendControl({ action: ControlAction.Next });
  };

  const handlePrevious = async () => {
    if (!prevLabel || loading) return;
    const confirmed = window.confirm(
      `Are you sure you want to go ${prevLabel.toLowerCase()}?`
    );
    if (!confirmed) return;
    await sendControl({ action: ControlAction.Previous });
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
        setError("Failed to update auto-advance");
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
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <CardTitle className="text-xl">Stage and Timer</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Control the event lifecycle and live stage timers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {prevLabel && (
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={handlePrevious}
            >
              <ArrowLeft className="h-4 w-4" />
              {prevLabel}
            </Button>
          )}
          {nextLabel && (
            <Button
              size="sm"
              disabled={loading}
              onClick={handleNext}
            >
              {nextLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stage Stepper */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Event Progress
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STAGES.map((s, idx) => {
              const isCurrent = s.key === session.stage;
              const isPast = idx < currentStageIndex;
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                    isCurrent
                      ? "border-accent bg-accent/10 font-bold text-accent"
                      : isPast
                        ? "border-white/20 bg-surface-deep text-foreground/80"
                        : "border-white/5 bg-surface-deep/40 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isCurrent
                        ? "bg-accent text-accent-foreground"
                        : isPast
                          ? "bg-white/20 text-foreground"
                          : "bg-white/5 text-muted-foreground"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="truncate">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timer Display & Controls */}
        <div className="rounded-lg border border-white/10 bg-surface-deep p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Stage Countdown
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight">
                  {countdown.formatted || "--:--"}
                </div>
                <div>
                  {countdown.status === "running" && (
                    <Badge variant="default">Running</Badge>
                  )}
                  {countdown.status === "paused" && (
                    <Badge variant="outline">Paused</Badge>
                  )}
                  {countdown.status === "expired" && (
                    <Badge className="border-destructive/30 bg-destructive/15 text-destructive font-semibold">
                      Time is up
                    </Badge>
                  )}
                  {countdown.status === "none" && (
                    <Badge variant="outline">No timer</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Auto-advance toggle */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer select-none rounded-md border border-white/10 bg-surface px-3 py-2 hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={session.autoAdvance}
                  onChange={handleToggleAutoAdvance}
                  disabled={loading}
                  className="h-4 w-4 rounded border-white/20 bg-surface-deep text-accent focus:ring-accent cursor-pointer"
                />
                <span className="text-sm font-medium text-foreground">
                  Auto-advance on expiry
                </span>
              </label>
            </div>
          </div>

          {/* Controls visible only during nominating / voting */}
          {isTimed ? (
            <div className="space-y-5 pt-4 border-t border-white/10">
              {/* Primary timer buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {countdown.isRunning ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={() => sendControl({ action: ControlAction.Pause })}
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                ) : countdown.isPaused ? (
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={() => sendControl({ action: ControlAction.Resume })}
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() =>
                    sendControl({ action: ControlAction.ClearTimer })
                  }
                >
                  <Square className="h-4 w-4" />
                  Stop timer
                </Button>

                <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

                {/* Quick deltas */}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() =>
                    sendControl({
                      action: ControlAction.AdjustTimer,
                      deltaMs: -5 * 60 * 1000,
                    })
                  }
                >
                  -5m
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading || !countdown.hasTimer}
                  onClick={() =>
                    sendControl({
                      action: ControlAction.AdjustTimer,
                      deltaMs: -1 * 60 * 1000,
                    })
                  }
                >
                  -1m
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    sendControl({
                      action: ControlAction.AdjustTimer,
                      deltaMs: 1 * 60 * 1000,
                    })
                  }
                >
                  +1m
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    sendControl({
                      action: ControlAction.AdjustTimer,
                      deltaMs: 5 * 60 * 1000,
                    })
                  }
                >
                  +5m
                </Button>
              </div>

              {/* Set timer forms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Set minutes */}
                <form
                  onSubmit={handleSetMinutes}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Set duration (mins)
                    </label>
                    <Input
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
                    variant="secondary"
                    disabled={loading || customMinutes <= 0}
                  >
                    <Timer className="h-4 w-4" />
                    Set
                  </Button>
                </form>

                {/* Set end time */}
                <form
                  onSubmit={handleSetEndTime}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Set end time (local)
                    </label>
                    <Input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={loading || !customEndTime}
                  >
                    <Timer className="h-4 w-4" />
                    Set end
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="pt-2 text-xs text-muted-foreground border-t border-white/10">
              Timer controls are only available during the nominating and voting stages.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
