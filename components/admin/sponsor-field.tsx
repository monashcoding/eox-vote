"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { SponsorDto, SponsorsDto } from "@/lib/api-types";
import { errorMessage } from "@/lib/client/error-message";
import { useAdminApi } from "./admin-gate";
import { NewSponsorDialog } from "./new-sponsor-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SponsorLogo } from "@/components/ui/sponsor-logo";

/** Select value of the "Add a new sponsor" row; never a sponsor id (those are UUIDs). */
const ADD_SPONSOR = "add-sponsor";

interface SponsorFieldProps {
  /** Selected sponsor id; null is "None". */
  value: string | null;
  onChange: (sponsorId: string | null) => void;
  /** The saved sponsor, so the trigger can show it before the list loads. */
  current?: SponsorDto | null;
  disabled?: boolean;
}

function SponsorRow({ sponsor }: { sponsor: SponsorDto }): React.JSX.Element {
  return (
    <>
      <SponsorLogo src={sponsor.logoUrl} size={24} alt="" />
      <span className="min-w-0 truncate">
        {sponsor.name}
        {sponsor.shortName && (
          <span className="font-normal text-muted"> ({sponsor.shortName})</span>
        )}
      </span>
    </>
  );
}

/**
 * "Collaborating with": None or one of the saved sponsors, plus a row that
 * opens a small form to add a sponsor. A new sponsor is selected straight
 * away and is saved for every other session too.
 */
export function SponsorField({
  value,
  onChange,
  current = null,
  disabled,
}: SponsorFieldProps): React.JSX.Element {
  const adminApi = useAdminApi();
  const [sponsors, setSponsors] = React.useState<SponsorDto[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let active = true;
    adminApi<SponsorsDto>("/api/admin/sponsors")
      .then((data) => {
        if (active) setSponsors(data.sponsors);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(errorMessage(err, "Could not load sponsors"));
      });
    return () => {
      active = false;
    };
  }, [adminApi]);

  // The saved sponsor shows even before the list loads (or if it was added
  // from another tab after the list loaded).
  const known =
    current && !sponsors?.some((s) => s.id === current.id)
      ? [...(sponsors ?? []), current]
      : (sponsors ?? []);
  const selected = known.find((s) => s.id === value) ?? null;

  const handleCreated = (sponsor: SponsorDto) => {
    setSponsors((list) =>
      [...(list ?? []), sponsor].sort((a, b) =>
        a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" })
      )
    );
    onChange(sponsor.id);
  };

  return (
    <div className="space-y-2">
      <Select<string | null>
        value={value}
        onValueChange={(next) => {
          if (next === ADD_SPONSOR) {
            setAdding(true);
          } else {
            onChange(next);
          }
        }}
        disabled={disabled}
      >
        <SelectLabel>Collaborating with</SelectLabel>
        <SelectTrigger ref={triggerRef}>
          {/* "None" is a real choice, so it is not styled as a placeholder. */}
          <SelectValue className="data-[placeholder]:text-foreground">
            {() => (selected ? <SponsorRow sponsor={selected} /> : "None")}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>
            <SelectItemText>None</SelectItemText>
          </SelectItem>
          {known.map((sponsor) => (
            <SelectItem key={sponsor.id} value={sponsor.id} label={sponsor.name}>
              <SelectItemText className="flex min-w-0 items-center gap-2">
                <SponsorRow sponsor={sponsor} />
              </SelectItemText>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={ADD_SPONSOR} label="Add a new sponsor">
            <Plus className="size-4 shrink-0 text-muted" />
            Add a new sponsor
          </SelectItem>
        </SelectContent>
      </Select>
      {loadError && <p className="text-xs text-danger">{loadError}</p>}
      <NewSponsorDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={handleCreated}
        returnFocusRef={triggerRef}
      />
    </div>
  );
}
