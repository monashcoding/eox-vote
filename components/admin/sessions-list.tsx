"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, ExternalLink, Star, StarOff, Users, ThumbsUp } from "lucide-react";
import { AdminSessionSummaryDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { StagePill, CurrentBadge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorNote, Mascot } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eyebrow, Label } from "@/components/ui/label";

interface SessionsListProps {
  initialSessions?: AdminSessionSummaryDto[];
  initialCurrentSessionId?: string | null;
}

export function SessionsList({
  initialSessions = [],
  initialCurrentSessionId = null,
}: SessionsListProps): React.JSX.Element {
  const [sessions, setSessions] = React.useState<AdminSessionSummaryDto[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(initialCurrentSessionId);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState("");
  const [nominatingMinutes, setNominatingMinutes] = React.useState(30);
  const [votingMinutes, setVotingMinutes] = React.useState(45);
  const [autoAdvance, setAutoAdvance] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Deleting session ID requiring confirmation
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);

  const fetchSessions = React.useCallback(async () => {
    try {
      const data = await api<{
        sessions: AdminSessionSummaryDto[];
        currentSessionId: string | null;
      }>("/api/admin/sessions");
      setSessions(data.sessions);
      setCurrentSessionId(data.currentSessionId);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not load sessions");
      }
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    api<{
      sessions: AdminSessionSummaryDto[];
      currentSessionId: string | null;
    }>("/api/admin/sessions")
      .then((data) => {
        if (active) {
          setSessions(data.sessions);
          setCurrentSessionId(data.currentSessionId);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : "Could not load sessions"
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;

    setCreating(true);
    setCreateError(null);

    try {
      await api("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          nominatingMinutes,
          votingMinutes,
          autoAdvance,
        }),
      });
      setName("");
      setNominatingMinutes(30);
      setVotingMinutes(45);
      setAutoAdvance(false);
      setShowCreate(false);
      await fetchSessions();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCreateError(err.message);
      } else {
        setCreateError("Could not create the session");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleCurrent = async (sessionId: string) => {
    const isCurrent = sessionId === currentSessionId;
    const nextSessionId = isCurrent ? null : sessionId;
    setActionLoadingId(sessionId);

    try {
      await api("/api/admin/current", {
        method: "PUT",
        body: JSON.stringify({ sessionId: nextSessionId }),
      });
      setCurrentSessionId(nextSessionId);
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          isCurrent: s.id === nextSessionId,
        }))
      );
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : "Could not update the current session");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    setActionLoadingId(sessionId);
    try {
      await api(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
      });
      setConfirmDeleteId(null);
      await fetchSessions();
    } catch (err: unknown) {
      alert(err instanceof ApiError ? err.message : "Could not delete the session");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Eyebrow>Host console</Eyebrow>
          <h2 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
            Sessions
          </h2>
          <p className="text-sm text-muted">
            Create, manage and choose the session attendees see.
          </p>
        </div>
        <Button
          variant={showCreate ? "secondary" : "default"}
          onClick={() => setShowCreate(!showCreate)}
          className="w-full md:w-auto"
        >
          <Plus />
          <span>{showCreate ? "Cancel" : "New session"}</span>
        </Button>
      </div>

      {showCreate && (
        <Card className="animate-rise-in">
          <CardHeader>
            <CardTitle>Create a session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Session name</Label>
                <Input
                  id="session-name"
                  placeholder="For example, End of exams gala 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nom-mins">Nominating timer (minutes)</Label>
                  <Input
                    id="nom-mins"
                    type="number"
                    min={0}
                    max={600}
                    value={nominatingMinutes}
                    onChange={(e) => setNominatingMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted">0 means no timer for nominations</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vote-mins">Voting timer (minutes)</Label>
                  <Input
                    id="vote-mins"
                    type="number"
                    min={0}
                    max={600}
                    value={votingMinutes}
                    onChange={(e) => setVotingMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted">0 means no timer for voting</p>
                </div>
              </div>

              <label
                htmlFor="auto-advance"
                className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground md:min-h-0"
              >
                <input
                  id="auto-advance"
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="size-5 shrink-0 cursor-pointer accent-primary md:size-4"
                />
                Move to the next stage when the timer ends
              </label>

              <ErrorNote message={createError} />

              <div className="flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end md:gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={creating || !name.trim()}
                >
                  {creating ? "Creating..." : "Create session"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <ErrorNote message={error} />

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <EmptyState
            mascot={Mascot.Wave}
            title="No sessions yet"
            description="Create your first session to open nominations."
            action={
              !showCreate && (
                <Button size="lg" onClick={() => setShowCreate(true)}>
                  <Plus />
                  New session
                </Button>
              )
            }
          />
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const isConfirmingDelete = confirmDeleteId === s.id;
            const isBusy = actionLoadingId === s.id;

            return (
              <Card
                key={s.id}
                className={cn(
                  "p-4 sm:p-4 md:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                  "duration-200 ease-reveal",
                  isCurrent && "border-primary"
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-semibold text-foreground">
                        {s.name}
                      </h3>
                      <StagePill stage={s.stage} />
                      {isCurrent && <CurrentBadge />}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="size-3.5" />
                        {s.nomineeCount} {s.nomineeCount === 1 ? "nominee" : "nominees"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ThumbsUp className="size-3.5" />
                        {s.voteCount} {s.voteCount === 1 ? "vote" : "votes"}
                      </span>
                      <span>
                        Created {new Date(s.createdAt).toLocaleDateString("en-AU")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={isCurrent ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => handleToggleCurrent(s.id)}
                      disabled={isBusy}
                    >
                      {isCurrent ? (
                        <>
                          <StarOff />
                          <span>Unset current</span>
                        </>
                      ) : (
                        <>
                          <Star />
                          <span>Make current</span>
                        </>
                      )}
                    </Button>

                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLink />
                      <span>Manage</span>
                    </Link>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 rounded-control border-2 border-danger/50 bg-danger/10 p-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(s.id)}
                          disabled={isBusy}
                        >
                          Confirm delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isBusy}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeleteId(s.id)}
                        disabled={isBusy}
                        aria-label={`Delete ${s.name}`}
                        className="hover:text-danger"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
