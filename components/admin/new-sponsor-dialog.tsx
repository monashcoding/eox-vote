"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";
import type { SponsorDto } from "@/lib/api-types";
import { errorMessage } from "@/lib/client/error-message";
import { resizeLogo } from "@/lib/client/resize-image";
import {
  SPONSOR_NAME_MAX,
  SPONSOR_SHORT_NAME_MAX,
} from "@/lib/sponsor-fields";
import { cn } from "@/lib/utils";
import { useAdminApi } from "./admin-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorNote } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewSponsorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (sponsor: SponsorDto) => void;
  /** Focus goes back here on close (the select trigger that opened it). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

/**
 * Small form for a new collaborating society: full name, optional short
 * name and a logo. A bottom sheet on phones, a centred window from `sm` up
 * (guide 17.6). The logo is resized in the browser before upload.
 */
export function NewSponsorDialog({
  open,
  onOpenChange,
  onCreated,
  returnFocusRef,
}: NewSponsorDialogProps): React.JSX.Element {
  const adminApi = useAdminApi();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [shortName, setShortName] = React.useState("");
  const [logo, setLogo] = React.useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Each preview URL is released when it is replaced and on unmount.
  const logoUrlRef = React.useRef<string | null>(null);
  const swapLogo = (next: { file: File; url: string } | null) => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    logoUrlRef.current = next?.url ?? null;
    setLogo(next);
  };
  React.useEffect(
    () => () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    },
    []
  );

  const reset = () => {
    setName("");
    setShortName("");
    swapLogo(null);
    setError(null);
  };

  const pickLogo = async (file: File) => {
    setError(null);
    try {
      const resized = await resizeLogo(file);
      swapLogo({ file: resized, url: URL.createObjectURL(resized) });
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not read that logo"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The dialog is portalled, but React still bubbles its submit event to
    // the session form around the field; stop it here.
    e.stopPropagation();
    if (saving || !name.trim() || !logo) return;

    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("name", name.trim());
      body.set("shortName", shortName.trim());
      body.set("logo", logo.file);
      const sponsor = await adminApi<SponsorDto>("/api/admin/sponsors", {
        method: "POST",
        body,
      });
      onCreated(sponsor);
      onOpenChange(false);
      reset();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not add the sponsor"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) reset();
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          // Keyboard and mouse start in the name field; on touch the
          // keyboard would cover the sheet, so focus stays on the dialog.
          initialFocus={(openType) => (openType === "touch" ? true : nameRef.current)}
          finalFocus={returnFocusRef}
          className={cn(
            "inset-x-0 bottom-0 flex max-h-[90dvh] flex-col overflow-y-auto overscroll-contain rounded-t-panel border-x-2 border-t-2 border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-foreground shadow-dialog",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-panel sm:border-2 sm:p-6"
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold">
                Add a new sponsor
              </DialogTitle>
              <p className="text-sm text-muted">
                Saved sponsors can be picked for any session.
              </p>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="-mt-2 -mr-2 shrink-0"
                />
              }
              disabled={saving}
            >
              <X />
            </DialogClose>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sponsor-name">Full name</Label>
              <Input
                id="sponsor-name"
                ref={nameRef}
                placeholder="For example, Computing and Information Systems Students Association"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={SPONSOR_NAME_MAX}
                autoComplete="off"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sponsor-short-name">Short name (optional)</Label>
              <Input
                id="sponsor-short-name"
                placeholder="For example, CISSA"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                maxLength={SPONSOR_SHORT_NAME_MAX}
                autoComplete="off"
                disabled={saving}
              />
              <p className="text-xs text-muted">
                Shown as &quot;MAC × CISSA&quot; where space is tight.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sponsor-logo">Logo</Label>
              <div className="flex items-center gap-4">
                <label
                  htmlFor="sponsor-logo"
                  className={cn(
                    "flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-panel border-2 border-dashed border-border-strong bg-surface-soft p-2 text-muted transition-colors duration-150 ease-reveal hover:bg-accent has-[+input:focus-visible]:border-ring has-[+input:focus-visible]:ring-2 has-[+input:focus-visible]:ring-ring/30",
                    saving && "pointer-events-none opacity-50"
                  )}
                >
                  {logo ? (
                    <img
                      src={logo.url}
                      alt="Logo preview"
                      className="size-full object-contain"
                    />
                  ) : (
                    <ImagePlus className="size-6" />
                  )}
                </label>
                <input
                  id="sponsor-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void pickLogo(file);
                    e.target.value = "";
                  }}
                />
                <p className="text-xs text-muted">
                  PNG, JPEG or WebP, shown square beside the MAC logo. A
                  transparent background looks best.
                </p>
              </div>
            </div>

            <ErrorNote message={error} />

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
              <DialogClose
                render={<Button type="button" variant="ghost" />}
                disabled={saving}
              >
                Cancel
              </DialogClose>
              <Button
                type="submit"
                size="lg"
                disabled={saving || !name.trim() || !logo}
              >
                {saving ? "Adding..." : "Add sponsor"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
