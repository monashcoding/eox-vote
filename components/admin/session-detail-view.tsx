"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { usePolling } from "@/lib/client/use-polling";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NomineesPanel } from "./nominees-panel";
import { SessionHeader } from "./session-header";
import { SessionSettingsPanel } from "./session-settings-panel";
import { SessionStagePanel } from "./session-stage-panel";

interface SessionDetailViewProps {
  sessionId: string;
}

export function SessionDetailView({
  sessionId,
}: SessionDetailViewProps): React.JSX.Element {
  const [session, setSession] = React.useState<AdminSessionDetailDto | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSession = React.useCallback(async () => {
    try {
      const data = await api<AdminSessionDetailDto>(
        `/api/admin/sessions/${sessionId}`
      );
      setSession(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load session details");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Spec: "admin detail polls every 2000 ms"
  usePolling(fetchSession, 2000);

  if (loading && !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Loading session...
          </span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sessions
        </Link>
        <Card className="p-12 text-center border-destructive/20 bg-destructive/5">
          <p className="text-sm text-destructive">
            {error ?? "Session not found"}
          </p>
          <div className="mt-4">
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                Return to sessions
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Session Header */}
      <SessionHeader session={session} onRefresh={fetchSession} />

      {/* Panels container */}
      <div className="space-y-8">
        {/* Stage & Timer Panel */}
        <SessionStagePanel session={session} onRefresh={fetchSession} />
        <NomineesPanel session={session} onRefresh={fetchSession} />
        {/* Results Panel (Results agent adds here) */}
        {/* QR Code Panel (QR agent adds here) */}

        {/* Settings Panel */}
        <SessionSettingsPanel session={session} onRefresh={fetchSession} />
      </div>
    </div>
  );
}
