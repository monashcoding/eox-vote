"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/label";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b-2 border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-col leading-tight">
            <Eyebrow>MAC - Best dressed</Eyebrow>
            <h1 className="truncate text-base font-semibold text-foreground">
              Host console
            </h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut />
            <span>Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="animate-rise-in">{children}</div>
      </main>
    </div>
  );
}
