"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Star, StarOff } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { CurrentBadge, StagePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SessionHeaderProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

export function SessionHeader({
  session,
  onRefresh,
}: SessionHeaderProps): React.JSX.Element {
  const [updatingCurrent, setUpdatingCurrent] = React.useState(false);

  const handleToggleCurrent = async () => {
    setUpdatingCurrent(true);
    try {
      await api("/api/admin/current", {
        method: "PUT",
        body: JSON.stringify({
          sessionId: session.isCurrent ? null : session.id,
        }),
      });
      await onRefresh();
    } catch (err: unknown) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to update current session"
      );
    } finally {
      setUpdatingCurrent(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sessions
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {session.name}
            </h1>
            <StagePill stage={session.stage} />
            {session.isCurrent && <CurrentBadge />}
          </div>
          <p className="text-xs text-muted-foreground">
            Created {new Date(session.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={session.isCurrent ? "secondary" : "primary"}
            size="sm"
            onClick={handleToggleCurrent}
            disabled={updatingCurrent}
          >
            {session.isCurrent ? (
              <>
                <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Unset current</span>
              </>
            ) : (
              <>
                <Star className="h-3.5 w-3.5 text-accent-foreground" />
                <span>Make current</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
