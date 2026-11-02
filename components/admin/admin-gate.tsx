"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/client/api";
import { AdminShell } from "./admin-shell";
import { PasscodeForm } from "./passcode-form";

interface AdminGateProps {
  children?: React.ReactNode;
}

export function AdminGate({ children }: AdminGateProps): React.JSX.Element {
  const [status, setStatus] = React.useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [initialError, setInitialError] = React.useState<string | undefined>();
  React.useEffect(() => {
    let active = true;
    api<{ authenticated: boolean }>("/api/admin/auth")
      .then(() => {
        if (active) {
          setStatus("authenticated");
          setInitialError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setStatus("unauthenticated");
          if (err instanceof ApiError && err.status === 503) {
            setInitialError(err.message);
          }
        }
      });
    return () => {
      active = false;
    };
  }, []);
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background">
        <PasscodeForm
          onSuccess={() => setStatus("authenticated")}
          initialError={initialError}
        />
      </div>
    );
  }

  return (
    <AdminShell onSignOut={() => setStatus("unauthenticated")}>
      {children}
    </AdminShell>
  );
}
