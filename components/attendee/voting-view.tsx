"use client";

import * as React from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import type {
  MeDto,
  PublicNomineeDto,
  PublicSessionDto,
  VoteDto,
  VotesDto,
} from "@/lib/api-types";
import { api, ApiError } from "@/lib/client/api";
import {
  getDeckSeed,
  loadSwipeHistory,
  loadSwipedByCategory,
  saveSwipeHistory,
  saveSwipedByCategory,
  shuffleBySeed,
  type SwipedByCategory,
} from "@/lib/client/deck-storage";
import { errorMessage } from "@/lib/client/error-message";
import { usePolling } from "@/lib/client/use-polling";
import { ATTENDEE_RETENTION_NOTICE } from "@/lib/retention";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeDeck, type SwipeCard } from "./swipe-deck";
import type { SwipeDirection } from "@/lib/client/swipe-decision";
import {
  pruneSwipeHistory,
  recordSwipe,
  forgetSwipe,
  undoLastSwipe,
  VoteChange,
  voteChangeFor,
  type SwipeHistory,
} from "@/lib/client/swipe-history";
import { CategoryTabs } from "./category-tabs";
import { PhotoPreview, type PreviewPhoto } from "./photo-preview";
import { VoteGrid } from "./vote-grid";

const Tab = {
  Swipe: "swipe",
  All: "all",
} as const;

type Tab = (typeof Tab)[keyof typeof Tab];

/** Bottom bar triggers fill their half: no rounding, border or inset gap. */
const TAB_TRIGGER_CLASS =
  "rounded-none border-0 focus-visible:ring-inset data-active:bg-accent";

/** This device's votes: nominee ids per category id. */
type VotesByCategory = Readonly<Record<string, ReadonlySet<string>>>;

const NO_IDS: ReadonlySet<string> = new Set();

function fullName(nominee: PublicNomineeDto): string {
  return `${nominee.firstName} ${nominee.lastName}`;
}

/** One vote's key: requests and their pending state are per nominee per category. */
function voteKey(categoryId: string, nomineeId: string): string {
  return `${categoryId}:${nomineeId}`;
}

function groupVotes(votes: readonly VoteDto[]): VotesByCategory {
  const grouped: Record<string, Set<string>> = {};
  for (const vote of votes) {
    (grouped[vote.categoryId] ??= new Set()).add(vote.nomineeId);
  }
  return grouped;
}

/**
 * Swiping for every category of the session. Each category is its own deck of
 * every nominee, swiped one category after another: the tabs above switch
 * between them, and finishing a deck moves on to the next category with cards
 * left. Undo takes back the last swipe in any category and shows its deck.
 */
export function VotingView({
  session,
  onChanged,
}: {
  session: PublicSessionDto;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  const { categories, nominees } = session;
  const [tab, setTab] = React.useState<Tab>(Tab.Swipe);
  // Null until the attendee picks a tab or finishes a deck; until then the
  // first category with cards left shows.
  const [chosenCategoryId, setChosenCategoryId] = React.useState<string | null>(
    null
  );
  const [votes, setVotes] = React.useState<VotesByCategory | null>(null);
  const [pendingKeys, setPendingKeys] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [swiped, setSwiped] = React.useState<SwipedByCategory>(() =>
    loadSwipedByCategory(session.id)
  );
  const [history, setHistory] = React.useState<SwipeHistory>(() =>
    loadSwipeHistory(session.id)
  );
  const [returningCard, setReturningCard] = React.useState<{
    categoryId: string;
    id: string;
    direction: SwipeDirection;
  } | null>(null);
  const [seed] = React.useState(getDeckSeed);
  // The photo stays set while `open` goes false, so it fades out with the preview.
  // `fromDeck`: opened from the deck's top card, so it can be swiped.
  const [preview, setPreview] = React.useState<{
    photo: PreviewPhoto;
    open: boolean;
    fromDeck: boolean;
  } | null>(null);
  const openPreview = (photo: PreviewPhoto, fromDeck = false) =>
    setPreview({ photo, open: true, fromDeck });
  const [error, setError] = React.useState<string | null>(null);
  const inFlight = React.useRef(0);
  const loaded = React.useRef(false);
  // The latest request per vote key; the next one waits for it.
  const requestChains = React.useRef(new Map<string, Promise<boolean>>());

  const loadMe = React.useCallback(async () => {
    try {
      const me = await api<MeDto>("/api/me");
      loaded.current = true;
      // Never overwrite optimistic state while a vote request is in flight.
      if (inFlight.current === 0) {
        setVotes(groupVotes(me.votes));
      }
    } catch (err: unknown) {
      if (!loaded.current) {
        setError(errorMessage(err, "Could not load your votes"));
      }
    }
  }, []);

  // Initial load, then a slow refresh so host deletions show up.
  usePolling(loadMe, 15000);

  const cardsLeftIn = (categoryId: string): number => {
    const done = new Set(swiped[categoryId] ?? []);
    return nominees.filter((nominee) => !done.has(nominee.id)).length;
  };
  const category =
    categories.find((c) => c.id === chosenCategoryId) ??
    categories.find((c) => cardsLeftIn(c.id) > 0) ??
    categories[0];

  // Each category shuffles on its own, so whoever comes first in one deck is
  // not first in every deck.
  const ordered = React.useMemo(
    () => shuffleBySeed(nominees, `${seed}:${category.id}`),
    [nominees, seed, category.id]
  );

  if (votes === null) {
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

  const votesNow = votes;
  const hasVote = (categoryId: string, nomineeId: string) =>
    (votesNow[categoryId] ?? NO_IDS).has(nomineeId);

  const setPending = (key: string, pending: boolean) =>
    setPendingKeys((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });

  const setVoted = (categoryId: string, nomineeId: string, vote: boolean) =>
    setVotes((current) => {
      const next = new Set(current?.[categoryId] ?? []);
      if (vote) next.add(nomineeId);
      else next.delete(nomineeId);
      return { ...current, [categoryId]: next };
    });

  /**
   * Optimistic vote or unvote. Resolves true on success, rolls back on failure.
   * Requests for one nominee in one category run one at a time, so the DELETE
   * from undoing a swipe always lands after that swipe's PUT.
   */
  const submitVote = (
    categoryId: string,
    nomineeId: string,
    vote: boolean
  ): Promise<boolean> => {
    const key = voteKey(categoryId, nomineeId);
    setError(null);
    setVoted(categoryId, nomineeId, vote);
    setPending(key, true);
    inFlight.current += 1;
    const previous = requestChains.current.get(key) ?? Promise.resolve(true);
    const request: Promise<boolean> = previous.then(async () => {
      try {
        await api<VotesDto>(`/api/votes/${categoryId}/${nomineeId}`, {
          method: vote ? "PUT" : "DELETE",
        });
        return true;
      } catch (err: unknown) {
        setVoted(categoryId, nomineeId, !vote);
        if (err instanceof ApiError && err.status === 409) {
          setError("Voting has closed, so your last change was not saved.");
          void onChanged();
        } else if (err instanceof ApiError && err.status === 404) {
          setError("That entry or category is no longer available.");
          void onChanged();
        } else {
          setError(`Could not save your vote. ${errorMessage(err, "Try again.")}`);
        }
        return false;
      } finally {
        inFlight.current -= 1;
        if (requestChains.current.get(key) === request) {
          requestChains.current.delete(key);
          setPending(key, false);
        }
      }
    });
    requestChains.current.set(key, request);
    return request;
  };

  const updateSwiped = (
    categoryId: string,
    update: (current: readonly string[]) => readonly string[]
  ) =>
    setSwiped((current) => {
      const next = { ...current, [categoryId]: update(current[categoryId] ?? []) };
      saveSwipedByCategory(session.id, next);
      return next;
    });

  const updateHistory = (update: (current: SwipeHistory) => SwipeHistory) =>
    setHistory((current) => {
      const next = update(current);
      saveSwipeHistory(session.id, next);
      return next;
    });

  const swipedHere = new Set(swiped[category.id] ?? []);
  const returningHere =
    returningCard?.categoryId === category.id ? returningCard : null;
  // The card undo put back goes on top, even ahead of cards that came back
  // after a failed vote (sort is stable, so the rest keep the deck order).
  const cards: SwipeCard[] = ordered
    .filter((nominee) => !swipedHere.has(nominee.id))
    .sort(
      (a, b) =>
        Number(b.id === returningHere?.id) - Number(a.id === returningHere?.id)
    )
    .map((nominee) => ({
      id: nominee.id,
      title: fullName(nominee),
      imageUrl: nominee.photoUrl,
    }));

  const handleSwipe = (card: SwipeCard, direction: SwipeDirection) => {
    const categoryId = category.id;
    // A new swipe or skip moves on from the last failed vote.
    setError(null);
    // Right casts a vote and left takes one back, so a skip after "Swipe
    // again" removes an earlier like. Undo reverses exactly this change.
    const voteChange = voteChangeFor(direction, hasVote(categoryId, card.id));
    updateSwiped(categoryId, (current) =>
      current.includes(card.id) ? current : [...current, card.id]
    );
    updateHistory((current) =>
      recordSwipe(current, { id: card.id, categoryId, direction, voteChange })
    );
    // That was this deck's last card: move on to the next category with cards
    // left, wrapping round, or stay on this one's summary when all are done.
    if (cards.length === 1 && cards[0].id === card.id) {
      const index = categories.findIndex((c) => c.id === categoryId);
      const next = [...categories.slice(index + 1), ...categories.slice(0, index)].find(
        (c) => cardsLeftIn(c.id) > 0
      );
      setChosenCategoryId(next?.id ?? categoryId);
    }
    if (voteChange === VoteChange.None) return;
    void submitVote(categoryId, card.id, voteChange === VoteChange.Added).then((ok) => {
      // A failed change puts the card back on its deck so it can be retried.
      // Work on the current list so later swipes are kept.
      if (ok) return;
      updateSwiped(categoryId, (current) => current.filter((id) => id !== card.id));
      updateHistory((current) => forgetSwipe(current, categoryId, card.id));
    });
  };

  const categoryIds = new Set(categories.map((c) => c.id));
  const nomineeIds = new Set(nominees.map((nominee) => nominee.id));
  // Swipes that can still be undone: cards still swiped away that still exist.
  const undoable = pruneSwipeHistory(
    history,
    (record) =>
      categoryIds.has(record.categoryId) &&
      nomineeIds.has(record.id) &&
      (swiped[record.categoryId] ?? []).includes(record.id)
  );

  const handleUndo = () => {
    const step = undoLastSwipe(undoable);
    if (!step) return;
    const { record } = step;
    setError(null);
    updateHistory(() => step.history);
    updateSwiped(record.categoryId, (current) =>
      current.filter((id) => id !== record.id)
    );
    setReturningCard({
      categoryId: record.categoryId,
      id: record.id,
      direction: record.direction,
    });
    // The last swipe may have been in another category, the one just
    // finished: show the deck the card goes back to.
    setChosenCategoryId(record.categoryId);
    if (step.restoreVote !== null) {
      void submitVote(record.categoryId, record.id, step.restoreVote);
    }
  };

  const multipleCategories = categories.length > 1;
  const votedHere = votesNow[category.id] ?? NO_IDS;
  const votedCount = ordered.filter((nominee) => votedHere.has(nominee.id)).length;
  const pendingPrefix = voteKey(category.id, "");
  const pendingHere = new Set(
    [...pendingKeys]
      .filter((key) => key.startsWith(pendingPrefix))
      .map((key) => key.slice(pendingPrefix.length))
  );
  const finishedCategories = new Set(
    nominees.length === 0
      ? []
      : categories.filter((c) => cardsLeftIn(c.id) === 0).map((c) => c.id)
  );
  const deckShown = tab === Tab.Swipe && cards.length > 0;

  /*
   * Opened from the deck, the preview always shows the deck's top card and
   * swipes it through handleSwipe, so votes, history and Undo match the deck.
   * The next card follows; swiping the last one closes the preview, on the
   * next category's deck or this one's summary. Opened anywhere else it stays
   * view only.
   */
  const deckPreview = preview?.fromDeck ? (cards[0] ?? null) : null;
  const previewPhoto = deckPreview
    ? { url: deckPreview.imageUrl, name: deckPreview.title }
    : (preview?.photo ?? null);
  const handlePreviewSwipe = (id: string, direction: SwipeDirection) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    handleSwipe(card, direction);
    // The last card has flown out: close with no photo, so it is not shown
    // again while the preview fades out.
    if (cards.length === 1) setPreview(null);
  };

  const grid = (
    <VoteGrid
      nominees={ordered}
      votedIds={votedHere}
      pendingIds={pendingHere}
      onToggle={(id, vote) => void submitVote(category.id, id, vote)}
      onOpenPhoto={openPreview}
    />
  );

  return (
    // A flex column down to the deck, so the deck gets the height left over.
    <CategoryTabs
      categories={categories}
      value={category.id}
      onValueChange={setChosenCategoryId}
      done={finishedCategories}
      className="flex flex-1 flex-col"
      contentClassName="flex flex-1 flex-col"
    >
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
                  {multipleCategories
                    ? `Swipe right to vote for ${category.name}, left to skip.`
                    : "Swipe right to vote, left to skip."}
                </p>
              </div>
              <SwipeDeck
                // Every category deals the same nominees, so a deck must not
                // carry a drag or a flight over into another category's deck.
                key={category.id}
                cards={cards}
                onSwipe={handleSwipe}
                onUndo={handleUndo}
                canUndo={undoable.length > 0}
                returningCard={returningHere}
                onOpenCard={(card) =>
                  openPreview({ url: card.imageUrl, name: card.title }, true)
                }
                className="min-h-56 flex-1 short:min-h-40"
              />
            </div>
          ) : (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug sm:text-xl">
                  You voted for {votedCount}
                  {multipleCategories && ` in ${category.name}`}
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
                      updateSwiped(category.id, () => []);
                      updateHistory((current) =>
                        current.filter((record) => record.categoryId !== category.id)
                      );
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
          <p className="mt-4 text-xs text-muted">{ATTENDEE_RETENTION_NOTICE}</p>
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
        <PhotoPreview
          photo={previewPhoto}
          open={preview?.open ?? false}
          onOpenChange={(open) =>
            setPreview((current) => (current ? { ...current, open } : null))
          }
          swipe={
            deckPreview
              ? { id: deckPreview.id, onSwipe: handlePreviewSwipe }
              : undefined
          }
          error={error}
        />
      </Tabs>
    </CategoryTabs>
  );
}
