"use client";

import * as React from "react";
import { Eye, EyeOff, Trophy, Undo2 } from "lucide-react";
import {
  AdminSessionDetailDto,
  ControlAction,
  ControlRequest,
  PodiumPlaceDto,
  Stage,
} from "@/lib/api-types";
import { useAdminApi } from "./admin-gate";
import { errorMessage } from "@/lib/client/error-message";
import { placeLabel } from "@/lib/place-label";
import { revealSteps } from "@/lib/session/ranking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";

interface ResultsPanelProps {
  session: AdminSessionDetailDto;
  onRefresh: () => Promise<void>;
}

export function ResultsPanel({
  session,
  onRefresh,
}: ResultsPanelProps): React.JSX.Element | null {
  const adminApi = useAdminApi();
  const [peeking, setPeeking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (session.stage !== Stage.Results && session.stage !== Stage.Finished) {
    return null;
  }

  const { revealedCount, totalRevealSteps, podiums, categories } = session;
  const isResults = session.stage === Stage.Results;
  const multiCategory = categories.length > 1;
  const nextStep =
    revealedCount >= totalRevealSteps
      ? null
      : (revealSteps(podiums)[revealedCount] ?? null);
  const nextCategoryName = nextStep
    ? categories.find((category) => category.id === nextStep.categoryId)?.name
    : undefined;

  const sendControl = async (request: ControlRequest) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi<AdminSessionDetailDto>(
        `/api/admin/sessions/${session.id}/control`,
        { method: "POST", body: JSON.stringify(request) }
      );
      await onRefresh();
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not update the reveal"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg sm:text-xl">Results</CardTitle>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={peeking}
          onClick={() => setPeeking((v) => !v)}
        >
          {peeking ? <EyeOff /> : <Eye />}
          <span>{peeking ? "Hide podium" : "Peek"}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorNote message={error} />

        {totalRevealSteps === 0 ? (
          <p className="rounded-control border-2 border-dashed border-border p-6 text-center text-sm text-muted">
            No votes were cast, so there is nothing to reveal.
          </p>
        ) : isResults ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={busy || !nextStep}
              onClick={() => void sendControl({ action: ControlAction.RevealNext })}
            >
              <Trophy />
              <span>
                {nextStep
                  ? multiCategory && nextCategoryName
                    ? `Reveal ${placeLabel(nextStep.place, true)} in ${nextCategoryName}`
                    : `Reveal ${placeLabel(nextStep.place, true)}`
                  : "All places revealed"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              disabled={busy || revealedCount === 0}
              onClick={() => void sendControl({ action: ControlAction.HideLast })}
            >
              <Undo2 />
              <span>Hide last</span>
            </Button>
            <p className="text-sm text-muted sm:ml-auto">
              Revealed{" "}
              <span className="inline-block min-w-[1ch] text-right font-semibold tabular-nums text-foreground">
                {revealedCount}
              </span>{" "}
              of{" "}
              <span className="inline-block min-w-[1ch] text-right font-semibold tabular-nums text-foreground">
                {totalRevealSteps}
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">
            The session is finished, so attendees see the full podium.
          </p>
        )}

        {peeking &&
          (multiCategory ? (
            <div className="space-y-4">
              {categories.map((category) => {
                const places =
                  podiums.find((podium) => podium.categoryId === category.id)
                    ?.places ?? [];
                return (
                  <section key={category.id} className="space-y-2">
                    <h3 className="text-sm font-semibold">{category.name}</h3>
                    {places.length > 0 ? (
                      <PeekList places={places} />
                    ) : (
                      <p className="text-sm text-muted">No votes</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            podiums[0] &&
            podiums[0].places.length > 0 && (
              <PeekList places={podiums[0].places} />
            )
          ))}
      </CardContent>
    </Card>
  );
}

/** One category's podium for the host's peek, 1st first. */
function PeekList({
  places,
}: {
  places: readonly PodiumPlaceDto[];
}): React.JSX.Element {
  return (
    <ol className="space-y-2">
      {places.map((group) => (
        <li
          key={group.place}
          className="rounded-control border-2 border-border bg-surface-soft p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>{placeLabel(group)}</Eyebrow>
            <span className="text-xs text-muted">
              <span className="font-semibold tabular-nums text-foreground">
                {group.votes}
              </span>{" "}
              {group.votes === 1 ? "vote" : "votes"}
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-3">
            {group.nominees.map((nominee) => (
              <li key={nominee.id} className="flex items-center gap-2">
                <img
                  src={nominee.photoUrl}
                  alt=""
                  className="size-10 rounded-control border-2 border-border object-cover"
                />
                <span className="text-sm font-semibold">
                  {nominee.firstName} {nominee.lastName}
                </span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
