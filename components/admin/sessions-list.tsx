"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, ExternalLink, Star, StarOff, Users, ThumbsUp } from "lucide-react";
import { AdminSessionSummaryDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { StagePill, CurrentBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        setError("Failed to load sessions");
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
            err instanceof ApiError ? err.message : "Failed to load sessions"
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
        setCreateError("Failed to create session");
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
      alert(err instanceof ApiError ? err.message : "Failed to update current session");
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
      alert(err instanceof ApiError ? err.message : "Failed to delete session");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, manage and activate event voting sessions.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreate(!showCreate)}
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{showCreate ? "Cancel" : "New Session"}</span>
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-white/15 bg-surface-deep">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Create New Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Session Name</Label>
                <Input
                  id="session-name"
                  placeholder="e.g. End of Exams Gala 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nom-mins">Nominating Timer (Minutes)</Label>
                  <Input
                    id="nom-mins"
                    type="number"
                    min={0}
                    max={600}
                    value={nominatingMinutes}
                    onChange={(e) => setNominatingMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = no timer for nominations
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vote-mins">Voting Timer (Minutes)</Label>
                  <Input
                    id="vote-mins"
                    type="number"
                    min={0}
                    max={600}
                    value={votingMinutes}
                    onChange={(e) => setVotingMinutes(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = no timer for voting
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  id="auto-advance"
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-surface text-accent focus:ring-accent"
                />
                <Label htmlFor="auto-advance" className="cursor-pointer normal-case text-sm tracking-normal text-foreground">
                  Auto-advance stage when timer expires
                </Label>
              </div>

              {createError && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
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
                  variant="primary"
                  disabled={creating || !name.trim()}
                >
                  {creating ? "Creating..." : "Create Session"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Global error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Sessions list */}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-white/10">
            <p className="text-sm text-muted-foreground">
              No sessions yet. Click &quot;New Session&quot; to get started.
            </p>
          </Card>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            const isConfirmingDelete = confirmDeleteId === s.id;
            const isBusy = actionLoadingId === s.id;

            return (
              <Card
                key={s.id}
                className={`transition-colors duration-150 ${
                  isCurrent ? "border-accent/40 bg-surface/90" : "bg-surface"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Info */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-semibold text-foreground">
                        {s.name}
                      </h3>
                      <StagePill stage={s.stage} />
                      {isCurrent && <CurrentBadge />}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {s.nomineeCount} {s.nomineeCount === 1 ? "nominee" : "nominees"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {s.voteCount} {s.voteCount === 1 ? "vote" : "votes"}
                      </span>
                      <span>
                        Created {new Date(s.createdAt).toLocaleDateString("en-AU")}
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={isCurrent ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleToggleCurrent(s.id)}
                      disabled={isBusy}
                      title={isCurrent ? "Unset current session" : "Make current session"}
                    >
                      {isCurrent ? (
                        <>
                          <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Unset current</span>
                        </>
                      ) : (
                        <>
                          <Star className="h-3.5 w-3.5 text-accent" />
                          <span>Make current</span>
                        </>
                      )}
                    </Button>

                    <Link href={`/admin/sessions/${s.id}`}>
                      <Button variant="secondary" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Manage</span>
                      </Button>
                    </Link>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-1">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(s.id)}
                          disabled={isBusy}
                        >
                          Confirm
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
                        size="sm"
                        onClick={() => setConfirmDeleteId(s.id)}
                        disabled={isBusy}
                        title="Delete session"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
