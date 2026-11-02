"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Star, StarOff } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { ApiError } from "@/lib/client/api";
import { useAdminApi } from "./admin-gate";
import { CurrentBadge, StagePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/label";

interface SessionHeaderProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

export function SessionHeader({
  session,
  onRefresh,
}: SessionHeaderProps): React.JSX.Element {
  const adminApi = useAdminApi();
  const [updatingCurrent, setUpdatingCurrent] = React.useState(false);

  const handleToggleCurrent = async () => {
    setUpdatingCurrent(true);
    try {
      await adminApi("/api/admin/current", {
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
          : "Could not update the current session"
      );
    } finally {
      setUpdatingCurrent(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin"
        className="group inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground md:min-h-0"
      >
        <ArrowLeft className="size-4 transition-transform duration-200 ease-reveal group-hover:-translate-x-0.5 motion-reduce:transform-none" />
        Back to sessions
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Eyebrow>Session</Eyebrow>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-foreground sm:text-3xl">
              {session.name}
            </h1>
            <StagePill stage={session.stage} />
            {session.isCurrent && <CurrentBadge />}
          </div>
          <p className="text-xs font-medium text-muted">
            Created {new Date(session.createdAt).toLocaleDateString("en-AU")}
          </p>
        </div>

        <Button
          variant={session.isCurrent ? "secondary" : "default"}
          onClick={handleToggleCurrent}
          disabled={updatingCurrent}
          className="w-full md:w-auto"
        >
          {session.isCurrent ? (
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
      </div>
    </div>
  );
}
