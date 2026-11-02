"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { ApiError } from "@/lib/client/api";
import { useAdminApi } from "./admin-gate";
import { usePolling } from "@/lib/client/use-polling";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Mascot } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { NomineesPanel } from "./nominees-panel";
import { QrPanel } from "./qr-panel";
import { ResultsPanel } from "./results-panel";
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

  const adminApi = useAdminApi();
  const fetchSession = React.useCallback(async () => {
    try {
      const data = await adminApi<AdminSessionDetailDto>(
        `/api/admin/sessions/${sessionId}`
      );
      setSession(data);
      setError(null);
    } catch (err: unknown) {
      // A deleted session can't come back, so drop it and show the error
      // view. Any other failure keeps the last good detail on screen: the
      // panels stay mounted, so half-typed edits and the scroll survive.
      if (err instanceof ApiError && err.status === 404) {
        setSession(null);
      }
      setError(
        err instanceof ApiError ? err.message : "Could not load session details"
      );
    } finally {
      setLoading(false);
    }
  }, [adminApi, sessionId]);

  // Spec: "admin detail polls every 2000 ms"
  usePolling(fetchSession, 2000);

  if (loading && !session) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground compact:min-h-0"
        >
          <ArrowLeft className="size-4" />
          Back to sessions
        </Link>
        <EmptyState
          mascot={Mascot.Sad}
          title="Could not load this session"
          description={error ?? "Session not found"}
          action={
            <Link href="/admin" className={buttonVariants({ variant: "secondary" })}>
              Return to sessions
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PollFailedNote visible={error !== null} />
      <div className="space-y-6 sm:space-y-8">
        <SessionHeader session={session} onRefresh={fetchSession} />

        <div className="space-y-6 sm:space-y-8">
          <SessionStagePanel session={session} onRefresh={fetchSession} />
          <NomineesPanel session={session} onRefresh={fetchSession} />
          <ResultsPanel session={session} onRefresh={fetchSession} />
          <QrPanel session={session} />

          <SessionSettingsPanel session={session} onRefresh={fetchSession} />
        </div>
      </div>
    </>
  );
}

/**
 * Shown while polls fail but the last good detail is still on screen. It sticks
 * just under the admin header and takes no space in the flow, so appearing and
 * clearing never shifts the panels under a host who is scrolled or typing.
 */
function PollFailedNote({ visible }: { visible: boolean }): React.JSX.Element {
  return (
    <div
      role="status"
      className="pointer-events-none sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-30 h-0"
    >
      {visible && (
        <p className="absolute inset-x-0 top-3 mx-auto w-fit max-w-full rounded-control border-2 border-danger/50 bg-card px-3 py-2 text-sm font-medium text-danger shadow-float">
          Can&apos;t reach the server. Retrying…
        </p>
      )}
    </div>
  );
}
