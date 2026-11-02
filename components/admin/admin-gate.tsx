"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/client/api";
import { Spinner } from "@/components/ui/skeleton";
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
        <Spinner label="Checking sign-in" />
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
