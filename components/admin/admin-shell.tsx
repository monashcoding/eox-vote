"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

interface AdminShellProps {
  children?: React.ReactNode;
  onSignOut: () => void;
}

export function AdminShell({
  children,
  onSignOut,
}: AdminShellProps): React.JSX.Element {
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api("/api/admin/logout", { method: "POST" });
    } finally {
      onSignOut();
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-white/10 bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              MAC &bull; Best Dressed
            </span>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Admin Console
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children ?? (
          <div className="rounded-lg border border-dashed border-white/10 bg-surface/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Signed in successfully. Session management will appear here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
