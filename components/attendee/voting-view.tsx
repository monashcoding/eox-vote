"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import type {
  MeDto,
  PublicNomineeDto,
  PublicSessionDto,
  VotesDto,
} from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import {
  getDeckSeed,
  loadSwipedIds,
  saveSwipedIds,
  shuffleBySeed,
} from "@/lib/client/deck-storage";
import { errorMessage } from "@/lib/client/error-message";
import { usePolling } from "@/lib/client/use-polling";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SwipeDeck,
  type SwipeCard,
  type SwipeDirection,
} from "./swipe-deck";
import { VoteGrid } from "./vote-grid";

const Tab = {
  Swipe: "swipe",
  All: "all",
} as const;

type Tab = (typeof Tab)[keyof typeof Tab];

function fullName(nominee: PublicNomineeDto): string {
  return `${nominee.firstName} ${nominee.lastName}`;
}

export function VotingView({
  session,
  onChanged,
}: {
  session: PublicSessionDto;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  const [tab, setTab] = React.useState<Tab>(Tab.Swipe);
  const [votedIds, setVotedIds] = React.useState<ReadonlySet<string> | null>(
    null
  );
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [swipedIds, setSwipedIds] = React.useState<readonly string[]>(() =>
    loadSwipedIds(session.id)
  );
  const [seed] = React.useState(getDeckSeed);
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(0);
  const loaded = React.useRef(false);

  const loadMe = React.useCallback(async () => {
    try {
      const me = await api<MeDto>("/api/me");
      loaded.current = true;
      // Never overwrite optimistic state while a vote request is in flight.
      if (inFlight.current === 0) {
        setVotedIds(new Set(me.votes));
      }
    } catch (err: unknown) {
      if (!loaded.current) {
        setError(errorMessage(err, "Could not load your votes"));
      }
    }
  }, []);

  // Initial load, then a slow refresh so host deletions show up.
  usePolling(loadMe, 15000);

  const ordered = React.useMemo(
    () => shuffleBySeed(session.nominees, seed),
    [session.nominees, seed]
  );

  if (votedIds === null) {
    return (
      <div className="flex justify-center py-12">
        {error ? (
          <div className="space-y-3 text-center">
            <ErrorNote message={error} />
            <Button
              variant="secondary"
              onClick={() => {
                setError(null);
                void loadMe();
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <Spinner label="Loading your votes" />
        )}
      </div>
    );
  }

  const voted = votedIds;

  const setPending = (nomineeId: string, pending: boolean) =>
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(nomineeId);
      else next.delete(nomineeId);
      return next;
    });

  const setVoted = (nomineeId: string, vote: boolean) =>
    setVotedIds((current) => {
      const next = new Set(current);
      if (vote) next.add(nomineeId);
      else next.delete(nomineeId);
      return next;
    });

  /** Optimistic vote or unvote. Resolves true on success, rolls back on failure. */
  const submitVote = async (
    nomineeId: string,
    vote: boolean
  ): Promise<boolean> => {
    setError(null);
    setVoted(nomineeId, vote);
    setPending(nomineeId, true);
    inFlight.current += 1;
    try {
      await api<VotesDto>(`/api/votes/${nomineeId}`, {
        method: vote ? "PUT" : "DELETE",
      });
      return true;
    } catch (err: unknown) {
      setVoted(nomineeId, !vote);
      if (err instanceof ApiError && err.status === 409) {
        setError("Voting has closed, so your last change was not saved.");
        void onChanged();
      } else if (err instanceof ApiError && err.status === 404) {
        setError("That entry is no longer available.");
        void onChanged();
      } else {
        setError(`Could not save your vote. ${errorMessage(err, "Try again.")}`);
      }
      return false;
    } finally {
      inFlight.current -= 1;
      setPending(nomineeId, false);
    }
  };

  const updateSwiped = (
    update: (current: readonly string[]) => readonly string[]
  ) =>
    setSwipedIds((current) => {
      const next = update(current);
      saveSwipedIds(session.id, next);
      return next;
    });

  const handleSwipe = (card: SwipeCard, direction: SwipeDirection) => {
    updateSwiped((current) =>
      current.includes(card.id) ? current : [...current, card.id]
    );
    if (direction === "right" && !voted.has(card.id)) {
      void submitVote(card.id, true).then((ok) => {
        // A failed vote puts the card back on the deck so it can be retried.
        // Work on the current list so later swipes are kept.
        if (!ok) updateSwiped((current) => current.filter((id) => id !== card.id));
      });
    }
  };

  const swiped = new Set(swipedIds);
  const cards: SwipeCard[] = ordered
    .filter((nominee) => !swiped.has(nominee.id))
    .map((nominee) => ({
      id: nominee.id,
      title: fullName(nominee),
      imageUrl: nominee.photoUrl,
    }));
  const votedCount = ordered.filter((nominee) => voted.has(nominee.id)).length;

  const grid = (
    <VoteGrid
      nominees={ordered}
      votedIds={voted}
      pendingIds={pendingIds}
      onToggle={(id, vote) => void submitVote(id, vote)}
    />
  );

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <TabsList>
        <TabsTrigger value={Tab.Swipe}>Swipe</TabsTrigger>
        <TabsTrigger value={Tab.All}>All ({ordered.length})</TabsTrigger>
      </TabsList>

      <ErrorNote message={error} className="mt-4" />

      <TabsContent value={Tab.Swipe} className="mt-6">
        {ordered.length === 0 ? (
          <EmptyState
            mascot={Mascot.Wave}
            title="No entries to vote on"
            description="Nobody was nominated in this session."
          />
        ) : cards.length > 0 ? (
          <div className="space-y-4">
            <div className="text-center">
              <Eyebrow>
                {cards.length} of {ordered.length} left
              </Eyebrow>
              <p className="mt-1 text-sm text-muted">
                Swipe right to vote, left to skip.
              </p>
            </div>
            <SwipeDeck cards={cards} onSwipe={handleSwipe} />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold leading-snug sm:text-xl">
                You voted for {votedCount}
              </h2>
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => updateSwiped(() => [])}
              >
                <RotateCcw />
                Swipe again
              </Button>
            </div>
            <p className="text-sm text-muted">
              Add or remove votes below until voting closes.
            </p>
            {grid}
          </section>
        )}
      </TabsContent>

      <TabsContent value={Tab.All} className="mt-6">
        {ordered.length === 0 ? (
          <EmptyState
            mascot={Mascot.Wave}
            title="No entries to vote on"
            description="Nobody was nominated in this session."
          />
        ) : (
          grid
        )}
      </TabsContent>
    </Tabs>
  );
}
