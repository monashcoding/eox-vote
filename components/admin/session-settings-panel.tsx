"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SessionSettingsPanelProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

export function SessionSettingsPanel({
  session,
  onRefresh,
}: SessionSettingsPanelProps): React.JSX.Element {
  const router = useRouter();

  const [name, setName] = React.useState(session.name);
  const [nominatingMinutes, setNominatingMinutes] = React.useState(
    session.nominatingMinutes
  );
  const [votingMinutes, setVotingMinutes] = React.useState(session.votingMinutes);
  const [autoAdvance, setAutoAdvance] = React.useState(session.autoAdvance);

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await api(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          nominatingMinutes,
          votingMinutes,
          autoAdvance,
        }),
      });
      setSaveSuccess(true);
      await onRefresh();
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update session settings");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api(`/api/admin/sessions/${session.id}`, {
        method: "DELETE",
      });
      router.push("/admin");
    } catch (err: unknown) {
      alert(
        err instanceof ApiError ? err.message : "Failed to delete session"
      );
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-surface">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Session Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Session Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-nom-mins">Nominating Timer (Minutes)</Label>
                <Input
                  id="edit-nom-mins"
                  type="number"
                  min={0}
                  max={600}
                  value={nominatingMinutes}
                  onChange={(e) =>
                    setNominatingMinutes(Number(e.target.value))
                  }
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Default duration for nominations (0 = no timer)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-vote-mins">Voting Timer (Minutes)</Label>
                <Input
                  id="edit-vote-mins"
                  type="number"
                  min={0}
                  max={600}
                  value={votingMinutes}
                  onChange={(e) => setVotingMinutes(Number(e.target.value))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Default duration for voting (0 = no timer)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                id="edit-auto-advance"
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded border-white/20 bg-surface text-accent focus:ring-accent"
              />
              <Label
                htmlFor="edit-auto-advance"
                className="cursor-pointer normal-case text-sm tracking-normal text-foreground"
              >
                Auto-advance to next stage when timer reaches zero
              </Label>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                {error}
              </div>
            )}

            {saveSuccess && (
              <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
                Settings saved successfully
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !name.trim()}
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20 bg-surface">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Delete this session
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently delete this session and all its associated nominees, photos, and votes.
              </p>
            </div>

            {showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Confirm delete"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete session</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
