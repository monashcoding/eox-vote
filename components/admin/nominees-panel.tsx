"use client";

import * as React from "react";
import { Eye, EyeOff, ImagePlus, Pencil, Trash2 } from "lucide-react";
import type { AdminNomineeDto, AdminSessionDetailDto } from "@/lib/api-types";
import { useAdminApi } from "./admin-gate";
import { errorMessage } from "@/lib/client/error-message";
import { resizeImage } from "@/lib/client/resize-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

interface NomineesPanelProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

function NomineeRow({
  nominee,
  showVotes,
  onRefresh,
}: {
  nominee: AdminNomineeDto;
  showVotes: boolean;
  onRefresh: () => Promise<void>;
}): React.JSX.Element {
  const adminApi = useAdminApi();
  const [editing, setEditing] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [firstName, setFirstName] = React.useState(nominee.firstName);
  const [lastName, setLastName] = React.useState(nominee.lastName);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputId = `nominee-photo-${nominee.id}`;

  const patch = async (body: FormData, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await adminApi(`/api/admin/nominees/${nominee.id}`, { method: "PATCH", body });
      onDone?.();
      await onRefresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not save changes"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNames = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const body = new FormData();
    body.set("firstName", firstName);
    body.set("lastName", lastName);
    void patch(body, () => setEditing(false));
  };

  const handleReplacePhoto = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("photo", await resizeImage(file));
      await adminApi(`/api/admin/nominees/${nominee.id}`, { method: "PATCH", body });
      await onRefresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not replace the photo"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi(`/api/admin/nominees/${nominee.id}`, { method: "DELETE" });
      await onRefresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not delete the nomination"));
      setConfirmingDelete(false);
      setBusy(false);
    }
  };

  // Each nominee is its own bordered item: the photo holds the left column and
  // everything else (name, votes, actions, edit form, delete confirm, errors)
  // stays in the column beside it, so wrapped controls never read as the next row's.
  return (
    <li className="flex items-start gap-3 rounded-panel border-2 border-border bg-surface-soft p-3">
      <img
        src={nominee.photoUrl}
        alt={`${nominee.firstName} ${nominee.lastName}`}
        className="size-14 shrink-0 rounded-full object-cover"
      />

      <div className="flex min-h-14 min-w-0 flex-1 flex-wrap content-center items-center gap-x-3 gap-y-2">
        {editing ? (
          <form
            onSubmit={handleSaveNames}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          >
            <Input
              aria-label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={50}
              required
              disabled={busy}
              className="sm:w-40"
            />
            <Input
              aria-label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={50}
              required
              disabled={busy}
              className="sm:w-40"
            />
            <Button
              type="submit"
              size="sm"
              disabled={busy || !firstName.trim() || !lastName.trim()}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1 basis-40">
              <p className="text-base font-semibold wrap-break-word compact:text-sm">
                {nominee.firstName} {nominee.lastName}
              </p>
              {showVotes && (
                <p className="text-xs font-semibold text-muted">
                  <span className="tabular-nums">{nominee.votes.toLocaleString()}</span>{" "}
                  {nominee.votes === 1 ? "vote" : "votes"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {confirmingDelete ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleDelete()}
                  >
                    {busy ? "Deleting..." : "Confirm delete"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Edit name of ${nominee.firstName} ${nominee.lastName}`}
                    onClick={() => {
                      setFirstName(nominee.firstName);
                      setLastName(nominee.lastName);
                      setEditing(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Replace photo of ${nominee.firstName} ${nominee.lastName}`}
                    onClick={() => document.getElementById(fileInputId)?.click()}
                  >
                    <ImagePlus />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Delete ${nominee.firstName} ${nominee.lastName}`}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleReplacePhoto(file);
            e.target.value = "";
          }}
        />

        <ErrorNote message={error} className="basis-full" />
      </div>
    </li>
  );
}

export function NomineesPanel({
  session,
  onRefresh,
}: NomineesPanelProps): React.JSX.Element {
  const [showVotes, setShowVotes] = React.useState(false);
  const nominees = session.nominees;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg sm:text-xl">
          Nominees ({nominees.length})
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={showVotes}
          onClick={() => setShowVotes((v) => !v)}
        >
          {showVotes ? <EyeOff /> : <Eye />}
          <span>{showVotes ? "Hide votes" : "Show votes"}</span>
        </Button>
      </CardHeader>
      <CardContent>
        {nominees.length === 0 ? (
          <p className="rounded-control border-2 border-dashed border-border p-6 text-center text-sm text-muted">
            No nominations yet. They appear here as attendees submit them.
          </p>
        ) : (
          <ul className="space-y-3">
            {nominees.map((nominee) => (
              <NomineeRow
                key={nominee.id}
                nominee={nominee}
                showVotes={showVotes}
                onRefresh={onRefresh}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
