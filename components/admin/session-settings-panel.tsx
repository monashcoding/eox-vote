"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { AdminSessionDetailDto } from "@/lib/api-types";
import { ApiError } from "@/lib/client/api";
import { useAdminApi } from "./admin-gate";
import { SponsorField } from "./sponsor-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SessionSettingsPanelProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

interface SettingsFields
  extends Pick<
    AdminSessionDetailDto,
    "name" | "nominatingMinutes" | "votingMinutes" | "autoAdvance"
  > {
  sponsorId: string | null;
}

/** Draft fields that differ from the saved session; trims the name first. */
function changedFields(
  draft: Partial<SettingsFields>,
  session: AdminSessionDetailDto
): Partial<SettingsFields> {
  const changes: Partial<SettingsFields> = {};
  const name = draft.name?.trim();
  if (name !== undefined && name !== session.name) changes.name = name;
  if (
    draft.nominatingMinutes !== undefined &&
    draft.nominatingMinutes !== session.nominatingMinutes
  ) {
    changes.nominatingMinutes = draft.nominatingMinutes;
  }
  if (
    draft.votingMinutes !== undefined &&
    draft.votingMinutes !== session.votingMinutes
  ) {
    changes.votingMinutes = draft.votingMinutes;
  }
  if (
    draft.autoAdvance !== undefined &&
    draft.autoAdvance !== session.autoAdvance
  ) {
    changes.autoAdvance = draft.autoAdvance;
  }
  if (
    draft.sponsorId !== undefined &&
    draft.sponsorId !== (session.sponsor?.id ?? null)
  ) {
    changes.sponsorId = draft.sponsorId;
  }
  return changes;
}

export function SessionSettingsPanel({
  session,
  onRefresh,
}: SessionSettingsPanelProps): React.JSX.Element {
  const router = useRouter();
  const adminApi = useAdminApi();

  // Only fields the host has edited live here. Everything else shows the
  // polled session, so changes from the stage panel or another tab show up
  // and a save never sends values the host did not touch.
  const [draft, setDraft] = React.useState<Partial<SettingsFields>>({});
  const name = draft.name ?? session.name;
  const nominatingMinutes =
    draft.nominatingMinutes ?? session.nominatingMinutes;
  const votingMinutes = draft.votingMinutes ?? session.votingMinutes;
  const autoAdvance = draft.autoAdvance ?? session.autoAdvance;
  const sponsorId =
    draft.sponsorId !== undefined ? draft.sponsorId : (session.sponsor?.id ?? null);
  const editField = <K extends keyof SettingsFields>(
    key: K,
    value: SettingsFields[K]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const changes = changedFields(draft, session);
  const dirty = Object.keys(changes).length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    if (!dirty) {
      setDraft({});
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await adminApi(`/api/admin/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await onRefresh();
      setDraft({});
      setSaveSuccess(true);
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
    setDeleteError(null);
    try {
      await adminApi(`/api/admin/sessions/${session.id}`, {
        method: "DELETE",
      });
      router.push("/admin");
    } catch (err: unknown) {
      setDeleteError(
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
                onChange={(e) => editField("name", e.target.value)}
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
                  onChange={(e) =>
                    editField("nominatingMinutes", Number(e.target.value))
                  }
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
                  onChange={(e) =>
                    editField("votingMinutes", Number(e.target.value))
                  }
                  disabled={saving}
                />
                <p className="text-xs text-muted">
                  Default length for voting (0 means no timer)
                </p>
              </div>
            </div>

            <SponsorField
              value={sponsorId}
              onChange={(next) => editField("sponsorId", next)}
              current={session.sponsor}
              disabled={saving}
            />

            <label
              htmlFor="edit-auto-advance"
              className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-foreground compact:min-h-0 compact:text-sm"
            >
              <input
                id="edit-auto-advance"
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => editField("autoAdvance", e.target.checked)}
                disabled={saving}
                className="size-5 shrink-0 cursor-pointer accent-primary compact:size-4"
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
                disabled={saving || !name.trim() || !dirty}
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
          <ErrorNote message={deleteError} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}
