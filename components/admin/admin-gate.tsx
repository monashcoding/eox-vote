"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/client/api";
import { Spinner } from "@/components/ui/skeleton";
import { AdminShell } from "./admin-shell";
import { PasscodeForm } from "./passcode-form";

interface AdminGateProps {
  children?: React.ReactNode;
}

type AdminApi = typeof api;

const AdminApiContext = React.createContext<AdminApi | null>(null);

/**
 * `api` for host requests made inside `AdminGate`. A 401 means the admin
 * cookie expired or the passcode changed, so it sends the host back to the
 * passcode form before rethrowing.
 */
export function useAdminApi(): AdminApi {
  const adminApi = React.useContext(AdminApiContext);
  if (!adminApi) {
    throw new Error("useAdminApi must be used inside AdminGate");
  }
  return adminApi;
}

export function AdminGate({ children }: AdminGateProps): React.JSX.Element {
  const [status, setStatus] = React.useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [initialError, setInitialError] = React.useState<string | undefined>();
  const adminApi = React.useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      try {
        return await api<T>(path, init);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          setInitialError("Your sign-in has expired. Enter the passcode again.");
          setStatus("unauthenticated");
        }
        throw err;
      }
    },
    []
  );
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
      <div className="safe-t safe-b flex min-h-dvh items-center justify-center bg-background">
        <Spinner label="Checking sign-in" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="safe-t safe-b min-h-dvh bg-background">
        <PasscodeForm
          onSuccess={() => setStatus("authenticated")}
          initialError={initialError}
        />
      </div>
    );
  }

  return (
    <AdminApiContext value={adminApi}>
      <AdminShell
        onSignOut={() => {
          setInitialError(undefined);
          setStatus("unauthenticated");
        }}
      >
        {children}
      </AdminShell>
    </AdminApiContext>
  );
}
