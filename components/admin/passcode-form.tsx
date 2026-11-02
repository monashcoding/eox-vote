"use client";

import * as React from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/components/ui/empty-state";
import { Eyebrow, Label } from "@/components/ui/label";
import { MacLogo } from "@/components/ui/mac-logo";

interface PasscodeFormProps {
  onSuccess: () => void;
  initialError?: string;
}

export function PasscodeForm({
  onSuccess,
  initialError,
}: PasscodeFormProps): React.JSX.Element {
  const [passcode, setPasscode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      await api<{ success: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ passcode }),
      });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="animate-rise-in w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <MacLogo size={56} className="mb-3" />
          <Eyebrow>Host access</Eyebrow>
          <CardTitle className="text-xl">Host console</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
                autoFocus
                disabled={loading}
              />
            </div>

            <ErrorNote message={error} />

            <Button
              type="submit"
              className="h-12 w-full compact:h-9"
              disabled={loading || !passcode.trim()}
            >
              {loading ? "Checking..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
