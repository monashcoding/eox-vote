"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
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
        setError("Could not update session settings");
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
        err instanceof ApiError ? err.message : "Could not delete the session"
      );
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Session settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Session name</Label>
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
                <Label htmlFor="edit-nom-mins">Nominating timer (minutes)</Label>
                <Input
                  id="edit-nom-mins"
                  type="number"
                  min={0}
                  max={600}
                  value={nominatingMinutes}
                  onChange={(e) => setNominatingMinutes(Number(e.target.value))}
                  disabled={saving}
                />
                <p className="text-xs text-muted">
                  Default length for nominations (0 means no timer)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-vote-mins">Voting timer (minutes)</Label>
                <Input
                  id="edit-vote-mins"
                  type="number"
                  min={0}
                  max={600}
                  value={votingMinutes}
                  onChange={(e) => setVotingMinutes(Number(e.target.value))}
                  disabled={saving}
                />
                <p className="text-xs text-muted">
                  Default length for voting (0 means no timer)
                </p>
              </div>
            </div>

            <label
              htmlFor="edit-auto-advance"
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground md:min-h-0"
            >
              <input
                id="edit-auto-advance"
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                disabled={saving}
                className="size-5 shrink-0 cursor-pointer accent-primary md:size-4"
              />
              Move to the next stage when the timer reaches zero
            </label>

            <ErrorNote message={error} />

            {saveSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-control border-2 border-success/50 bg-success/10 p-3 text-sm text-foreground"
              >
                <Check className="size-4 text-success" />
                Settings saved
              </div>
            )}

            <div className="flex pt-2 md:justify-end">
              <Button
                type="submit"
                size="lg"
                className="w-full md:w-auto"
                disabled={saving || !name.trim()}
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-danger/50">
        <CardHeader>
          <CardTitle className="text-lg text-danger sm:text-xl">
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Delete this session
              </p>
              <p className="text-xs text-muted">
                Permanently deletes this session and all its nominees, photos and votes.
              </p>
            </div>

            {showConfirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Confirm delete"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                onClick={() => setShowConfirmDelete(true)}
              >
                <Trash2 />
                <span>Delete session</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
