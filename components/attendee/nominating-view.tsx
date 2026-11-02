"use client";

import * as React from "react";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import type { MeDto, PublicNomineeDto, PublicSessionDto } from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import { resizeImage } from "@/lib/client/resize-image";
import { usePolling } from "@/lib/client/use-polling";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Tab = {
  Nominate: "nominate",
  All: "all",
} as const;

type Tab = (typeof Tab)[keyof typeof Tab];

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

interface PhotoFieldProps {
  id: string;
  previewUrl: string | null;
  onPick: (file: File) => void;
  disabled?: boolean;
  required?: boolean;
  label: string;
}

function PhotoField({
  id,
  previewUrl,
  onPick,
  disabled,
  required,
  label,
}: PhotoFieldProps): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <label
        htmlFor={id}
        className={cn(
          "flex aspect-[3/4] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/20 bg-surface-deep text-muted-foreground transition-colors duration-150 ease-reveal hover:border-accent",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Photo preview" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <ImagePlus className="h-6 w-6" />
            Choose a photo
          </span>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        required={required && !previewUrl}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Resizes a picked photo and keeps its object URL for the preview. */
function usePhoto(): {
  photo: File | null;
  previewUrl: string | null;
  error: string | null;
  pick: (file: File) => Promise<void>;
  reset: () => void;
} {
  const [picked, setPicked] = React.useState<{ file: File; url: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const urlRef = React.useRef<string | null>(null);

  const swap = React.useCallback((next: { file: File; url: string } | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next?.url ?? null;
    setPicked(next);
  }, []);

  React.useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const pick = React.useCallback(
    async (file: File) => {
      setError(null);
      try {
        const resized = await resizeImage(file);
        swap({ file: resized, url: URL.createObjectURL(resized) });
      } catch (err: unknown) {
        setError(errorMessage(err, "Could not read that photo"));
      }
    },
    [swap]
  );

  const reset = React.useCallback(() => {
    swap(null);
    setError(null);
  }, [swap]);

  const photo = picked?.file ?? null;
  const previewUrl = picked?.url ?? null;
  return { photo, previewUrl, error, pick, reset };
}

function ErrorNote({ message }: { message: string | null }): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
    >
      {message}
    </div>
  );
}

function NominateForm({
  onCreated,
}: {
  onCreated: (nominee: PublicNomineeDto) => void;
}): React.JSX.Element {
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const { photo, previewUrl, error: photoError, pick, reset } = usePhoto();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("firstName", firstName);
      body.set("lastName", lastName);
      body.set("photo", photo);
      const nominee = await api<PublicNomineeDto>("/api/nominations", {
        method: "POST",
        body,
      });
      setFirstName("");
      setLastName("");
      reset();
      onCreated(nominee);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not submit your nomination"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="nominee-first-name">First name</Label>
            <Input
              id="nominee-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={50}
              required
              autoComplete="off"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nominee-last-name">Last name</Label>
            <Input
              id="nominee-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={50}
              required
              autoComplete="off"
              disabled={submitting}
            />
          </div>
        </div>
        <PhotoField
          id="nominee-photo"
          label="Costume photo"
          previewUrl={previewUrl}
          onPick={(file) => void pick(file)}
          disabled={submitting}
          required
        />
        <ErrorNote message={photoError ?? error} />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !photo || !firstName.trim() || !lastName.trim()}
        >
          {submitting ? "Submitting..." : "Submit nomination"}
        </Button>
      </form>
    </Card>
  );
}

function OwnNominationRow({
  nominee,
  onUpdated,
  onDeleted,
}: {
  nominee: PublicNomineeDto;
  onUpdated: (nominee: PublicNomineeDto) => void;
  onDeleted: (id: string) => void;
}): React.JSX.Element {
  const [editing, setEditing] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [firstName, setFirstName] = React.useState(nominee.firstName);
  const [lastName, setLastName] = React.useState(nominee.lastName);
  const { photo, previewUrl, error: photoError, pick, reset } = usePhoto();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startEditing = () => {
    setFirstName(nominee.firstName);
    setLastName(nominee.lastName);
    reset();
    setError(null);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("firstName", firstName);
      body.set("lastName", lastName);
      if (photo) body.set("photo", photo);
      const updated = await api<PublicNomineeDto>(
        `/api/nominations/${nominee.id}`,
        { method: "PATCH", body }
      );
      setEditing(false);
      reset();
      onUpdated(updated);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not save your changes"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/nominations/${nominee.id}`, { method: "DELETE" });
      onDeleted(nominee.id);
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not delete your nomination"));
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  if (editing) {
    return (
      <Card asSurfaceDeep className="p-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`edit-first-${nominee.id}`}>First name</Label>
              <Input
                id={`edit-first-${nominee.id}`}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={50}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-last-${nominee.id}`}>Last name</Label>
              <Input
                id={`edit-last-${nominee.id}`}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={50}
                required
                disabled={busy}
              />
            </div>
          </div>
          <PhotoField
            id={`edit-photo-${nominee.id}`}
            label="Replace photo"
            previewUrl={previewUrl ?? nominee.photoUrl}
            onPick={(file) => void pick(file)}
            disabled={busy}
          />
          <ErrorNote message={photoError ?? error} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy || !firstName.trim() || !lastName.trim()}
            >
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card asSurfaceDeep className="space-y-3 p-3">
      <div className="flex items-center gap-3">
        <img
          src={nominee.photoUrl}
          alt={`${nominee.firstName} ${nominee.lastName}`}
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
        <p className="min-w-0 flex-1 truncate font-semibold">
          {nominee.firstName} {nominee.lastName}
        </p>
        {confirmingDelete ? (
          <div className="flex items-center gap-1">
            <Button variant="danger" size="sm" disabled={busy} onClick={handleDelete}>
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
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${nominee.firstName} ${nominee.lastName}`}
              onClick={startEditing}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${nominee.firstName} ${nominee.lastName}`}
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <ErrorNote message={error} />
    </Card>
  );
}

function NomineeGallery({
  nominees,
}: {
  nominees: PublicNomineeDto[];
}): React.JSX.Element {
  if (nominees.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No nominations yet. Be the first!
      </Card>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3">
      {nominees.map((nominee) => (
        <li
          key={nominee.id}
          className="overflow-hidden rounded-lg border border-white/10 bg-surface transition-transform duration-200 ease-reveal motion-safe:hover:-translate-y-0.5"
        >
          <img
            src={nominee.photoUrl}
            alt={`${nominee.firstName} ${nominee.lastName}`}
            loading="lazy"
            className="aspect-[3/4] w-full object-cover"
          />
          <p className="truncate px-3 py-2 text-sm font-semibold">
            {nominee.firstName} {nominee.lastName}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function NominatingView({
  session,
  onChanged,
}: {
  session: PublicSessionDto;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>(Tab.Nominate);
  const [me, setMe] = React.useState<MeDto | null>(null);
  const [meError, setMeError] = React.useState<string | null>(null);

  const loadMe = React.useCallback(async () => {
    try {
      setMe(await api<MeDto>("/api/me"));
      setMeError(null);
    } catch (err: unknown) {
      setMeError(
        err instanceof ApiError ? err.message : "Could not load your nominations"
      );
    }
  }, []);

  // Initial load, then a slow refresh so host edits and deletions show up.
  usePolling(loadMe, 15000);

  if (!me) {
    return (
      <div className="flex justify-center py-12">
        {meError ? (
          <div className="space-y-3 text-center">
            <ErrorNote message={meError} />
            <Button variant="secondary" size="sm" onClick={() => void loadMe()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
      </div>
    );
  }

  const nominations = me.nominations;
  const setNominations = (next: PublicNomineeDto[]) =>
    setMe({ ...me, nominations: next });
  const newestFirst = [...session.nominees].reverse();

  const tabs: { key: Tab; label: string }[] = [
    { key: Tab.Nominate, label: "Nominate" },
    { key: Tab.All, label: `Nominations (${session.nominees.length})` },
  ];

  return (
    <div className="space-y-6">
      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-surface-deep p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ease-reveal",
              tab === key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === Tab.Nominate ? (
        <>
          <NominateForm
            onCreated={(nominee) => {
              setNominations([...nominations, nominee]);
              void onChanged();
            }}
          />

          {nominations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Your nominations
              </h2>
              <ul className="space-y-3">
                {nominations.map((nominee) => (
                  <li key={nominee.id}>
                    <OwnNominationRow
                      nominee={nominee}
                      onUpdated={(updated) => {
                        setNominations(
                          nominations.map((n) => (n.id === updated.id ? updated : n))
                        );
                        void onChanged();
                      }}
                      onDeleted={(id) => {
                        setNominations(nominations.filter((n) => n.id !== id));
                        void onChanged();
                      }}
                    />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Lost access to your nominations, for example after clearing your
                browser data or switching phones? Ask a host and they can fix
                it for you.
              </p>
            </section>
          )}
        </>
      ) : (
        <NomineeGallery nominees={newestFirst} />
      )}
    </div>
  );
}
