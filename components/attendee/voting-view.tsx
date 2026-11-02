"use client";

import * as React from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import type {
  MeDto,
  PublicNomineeDto,
  PublicSessionDto,
  VotesDto,
} from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import {
  getDeckSeed,
  loadSwipeHistory,
  loadSwipedIds,
  saveSwipeHistory,
  saveSwipedIds,
  shuffleBySeed,
} from "@/lib/client/deck-storage";
import { errorMessage } from "@/lib/client/error-message";
import { usePolling } from "@/lib/client/use-polling";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeDeck, type SwipeCard } from "./swipe-deck";
import type { SwipeDirection } from "@/lib/client/swipe-decision";
import {
  forgetSwipe,
  pruneSwipeHistory,
  recordSwipe,
  undoLastSwipe,
  type SwipeHistory,
} from "@/lib/client/swipe-history";
import { VoteGrid } from "./vote-grid";

const Tab = {
  Swipe: "swipe",
  All: "all",
} as const;

type Tab = (typeof Tab)[keyof typeof Tab];

/** Bottom bar triggers fill their half: no rounding, border or inset gap. */
const TAB_TRIGGER_CLASS =
  "rounded-none border-0 focus-visible:ring-inset data-active:bg-accent";

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
  const [history, setHistory] = React.useState<SwipeHistory>(() =>
    loadSwipeHistory(session.id)
  );
  const [returningCard, setReturningCard] = React.useState<{
    id: string;
    direction: SwipeDirection;
  } | null>(null);
  const [seed] = React.useState(getDeckSeed);
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(0);
  const loaded = React.useRef(false);
  // The latest request per nominee; the next one waits for it.
  const requestChains = React.useRef(new Map<string, Promise<boolean>>());

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

  /**
   * Optimistic vote or unvote. Resolves true on success, rolls back on failure.
   * Requests for one nominee run one at a time, so the DELETE from undoing a
   * swipe always lands after that swipe's PUT.
   */
  const submitVote = (nomineeId: string, vote: boolean): Promise<boolean> => {
    setError(null);
    setVoted(nomineeId, vote);
    setPending(nomineeId, true);
    inFlight.current += 1;
    const previous = requestChains.current.get(nomineeId) ?? Promise.resolve(true);
    const request: Promise<boolean> = previous.then(async () => {
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
        if (requestChains.current.get(nomineeId) === request) {
          requestChains.current.delete(nomineeId);
          setPending(nomineeId, false);
        }
      }
    });
    requestChains.current.set(nomineeId, request);
    return request;
  };

  const updateSwiped = (
    update: (current: readonly string[]) => readonly string[]
  ) =>
    setSwipedIds((current) => {
      const next = update(current);
      saveSwipedIds(session.id, next);
      return next;
    });

  const updateHistory = (update: (current: SwipeHistory) => SwipeHistory) =>
    setHistory((current) => {
      const next = update(current);
      saveSwipeHistory(session.id, next);
      return next;
    });

  const handleSwipe = (card: SwipeCard, direction: SwipeDirection) => {
    // A new swipe or skip moves on from the last failed vote.
    setError(null);
    // Only a right swipe on a card without a vote casts one; undo takes back
    // exactly that.
    const addedVote = direction === "right" && !voted.has(card.id);
    updateSwiped((current) =>
      current.includes(card.id) ? current : [...current, card.id]
    );
    updateHistory((current) =>
      recordSwipe(current, { id: card.id, direction, addedVote })
    );
    if (addedVote) {
      void submitVote(card.id, true).then((ok) => {
        // A failed vote puts the card back on the deck so it can be retried.
        // Work on the current list so later swipes are kept.
        if (ok) return;
        updateSwiped((current) => current.filter((id) => id !== card.id));
        updateHistory((current) => forgetSwipe(current, card.id));
      });
    }
  };

  const swiped = new Set(swipedIds);
  // Swipes that can still be undone: cards still swiped away that still exist.
  const undoable = pruneSwipeHistory(
    history,
    new Set(ordered.filter((nominee) => swiped.has(nominee.id)).map((n) => n.id))
  );

  const handleUndo = () => {
    const step = undoLastSwipe(undoable);
    if (!step) return;
    setError(null);
    updateHistory(() => step.history);
    updateSwiped((current) => current.filter((id) => id !== step.record.id));
    setReturningCard({ id: step.record.id, direction: step.record.direction });
    if (step.removeVote) void submitVote(step.record.id, false);
  };

  // The card undo put back goes on top, even ahead of cards that came back
  // after a failed vote (sort is stable, so the rest keep the deck order).
  const cards: SwipeCard[] = ordered
    .filter((nominee) => !swiped.has(nominee.id))
    .sort(
      (a, b) =>
        Number(b.id === returningCard?.id) - Number(a.id === returningCard?.id)
    )
    .map((nominee) => ({
      id: nominee.id,
      title: fullName(nominee),
      imageUrl: nominee.photoUrl,
    }));

  const votedCount = ordered.filter((nominee) => voted.has(nominee.id)).length;
  const deckShown = tab === Tab.Swipe && cards.length > 0;

  const grid = (
    <VoteGrid
      nominees={ordered}
      votedIds={voted}
      pendingIds={pendingIds}
      onToggle={(id, vote) => void submitVote(id, vote)}
    />
  );

  return (
    // A flex column down to the deck, so the deck gets the height left over.
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="flex flex-1 flex-col"
    >
      {!deckShown && <ErrorNote message={error} className="mb-4" />}

      <TabsContent value={Tab.Swipe} className="mt-0 flex flex-1 flex-col">
        {ordered.length === 0 ? (
          <EmptyState
            mascot={Mascot.Wave}
            title="No entries to vote on"
            description="Nobody was nominated in this session."
          />
        ) : cards.length > 0 ? (
          <div className="relative flex flex-1 flex-col gap-4 short:gap-2">
            {/* Floats over the progress text and the top of the card, so it
                never moves the deck; opaque so it reads over the photo. */}
            {error && (
              <div className="absolute inset-x-0 top-0 z-40 rounded-control bg-background">
                <ErrorNote message={error} />
              </div>
            )}
            <div className="text-center">
              <Eyebrow>
                {cards.length} of {ordered.length} left
              </Eyebrow>
              {/* Dropped below 44rem tall: the card needs the room more than the hint. */}
              <p className="mt-1 text-sm text-muted [@media(height<44rem)]:hidden">
                Swipe right to vote, left to skip.
              </p>
            </div>
            <SwipeDeck
              cards={cards}
              onSwipe={handleSwipe}
              onUndo={handleUndo}
              canUndo={undoable.length > 0}
              returningCard={returningCard}
              className="min-h-56 flex-1 short:min-h-40"
            />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold leading-snug sm:text-xl">
                You voted for {votedCount}
              </h2>
              <div className="flex w-full gap-3 md:w-auto">
                {undoable.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 md:flex-none"
                    onClick={handleUndo}
                  >
                    <Undo2 />
                    Undo
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 md:flex-none"
                  onClick={() => {
                    updateSwiped(() => []);
                    updateHistory(() => []);
                  }}
                >
                  <RotateCcw />
                  Swipe again
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Add or remove votes below until voting closes.
            </p>
            {grid}
          </section>
        )}
      </TabsContent>

      <TabsContent value={Tab.All} className="mt-0">
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

      {/*
        Bottom tab bar. Under the deck it ends the one-screen column, above
        the shell's safe-area padding. Over the scrolling lists it sticks to
        the bottom of the screen; its padding covers the safe area there and
        the matching negative margin keeps the in-flow spacing unchanged.
      */}
      <div
        className={cn(
          "mt-4 sm:mt-6 short:mt-3",
          !deckShown &&
            "sticky bottom-0 z-20 -mb-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)] bg-background pt-3 pb-[calc(env(safe-area-inset-bottom,0px)_+_0.75rem)]"
        )}
      >
        {/* No inner padding or selection border: the active tab is the
            lighter fill with bold white text. */}
        <TabsList className="overflow-hidden p-0">
          <TabsTrigger value={Tab.Swipe} className={TAB_TRIGGER_CLASS}>
            Swipe
          </TabsTrigger>
          <TabsTrigger value={Tab.All} className={TAB_TRIGGER_CLASS}>
            All ({ordered.length})
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  );
}
