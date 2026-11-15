"use client";

import * as React from "react";
import { Check, RotateCcw, Undo2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorNote, Mascot } from "@/components/ui/empty-state";
import { Eyebrow } from "@/components/ui/label";
import { Spinner } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsLabel,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { BottomTabBar } from "./bottom-tab-bar";
import { PhotoPreview, type PreviewPhoto } from "./photo-preview";
import { VoteGrid } from "./vote-grid";

/** The All tab's value; every other tab is a category's deck, by id. */
const ALL_VIEW = "all";

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
 * every nominee, swiped one category after another. The bar under the deck
 * has a tab per category (just "Swipe" with one) and All; finishing a deck
 * moves on to the next category with cards left. The bar is the only control
 * row added for categories, so the photos keep their size. Undo takes back the
 * last swipe in any category and shows its deck.
 */
export function VotingView({
  session,
  onChanged,
}: {
  session: PublicSessionDto;
  onChanged: () => Promise<void>;
}): React.JSX.Element {
  const { categories, nominees } = session;
  // A category id or ALL_VIEW. Null until the attendee picks a tab or
  // finishes a deck; until then the first category with cards left shows.
  const [view, setView] = React.useState<string | null>(null);
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
  const showingAll = view === ALL_VIEW;
  // The deck's category. While All shows there is no deck, and this is only
  // the fallback that orders the grid.
  const category =
    categories.find((c) => c.id === view) ??
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
      setView(next?.id ?? categoryId);
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
    setView(record.categoryId);
    if (step.restoreVote !== null) {
      void submitVote(record.categoryId, record.id, step.restoreVote);
    }
  };

  const multipleCategories = categories.length > 1;
  const isPending = (categoryId: string, nomineeId: string) =>
    pendingKeys.has(voteKey(categoryId, nomineeId));
  const votedCount = ordered.filter((nominee) =>
    hasVote(category.id, nominee.id)
  ).length;
  const deckShown = !showingAll && cards.length > 0;

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

  const noEntries = (
    <EmptyState
      mascot={Mascot.Wave}
      title="No entries to vote on"
      description="Nobody was nominated in this session."
    />
  );

  return (
    // A flex column down to the deck, so the deck gets the height left over.
    <Tabs
      value={showingAll ? ALL_VIEW : category.id}
      onValueChange={(value) => setView(String(value))}
      className="flex flex-1 flex-col"
    >
      {!deckShown && <ErrorNote message={error} className="mb-4" />}

      <TabsContent value={category.id} className="mt-0 flex flex-1 flex-col">
        {ordered.length === 0 ? (
          noEntries
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
            <VoteGrid
              nominees={ordered}
              categories={[category]}
              hasVote={hasVote}
              isPending={isPending}
              onToggle={(categoryId, id, vote) => void submitVote(categoryId, id, vote)}
              onOpenPhoto={openPreview}
            />
          </section>
        )}
      </TabsContent>

      {/* Every entry, with a vote toggle for each category. */}
      <TabsContent value={ALL_VIEW} className="mt-0">
        {ordered.length === 0 ? (
          noEntries
        ) : (
          <VoteGrid
            nominees={ordered}
            categories={categories}
            hasVote={hasVote}
            isPending={isPending}
            onToggle={(categoryId, id, vote) => void submitVote(categoryId, id, vote)}
            onOpenPhoto={openPreview}
          />
        )}
        <p className="mt-4 text-xs text-muted">{ATTENDEE_RETENTION_NOTICE}</p>
      </TabsContent>

      {/* One bar for the decks and All: categories share it with All rather
          than adding a row, so the deck keeps its height. */}
      <BottomTabBar sticky={!deckShown}>
        <TabsList aria-label={multipleCategories ? "Categories" : undefined}>
          {categories.map((c) => {
            const finished = nominees.length > 0 && cardsLeftIn(c.id) === 0;
            return (
              <TabsTrigger key={c.id} value={c.id}>
                {multipleCategories ? (
                  <>
                    {/* In the corner, so the name keeps the tab's full width. */}
                    {finished && (
                      <Check
                        aria-hidden
                        strokeWidth={3}
                        className="absolute top-1 right-1 size-3 text-success"
                      />
                    )}
                    <TabsLabel>{c.name}</TabsLabel>
                    {finished && <span className="sr-only"> (done)</span>}
                  </>
                ) : (
                  "Swipe"
                )}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value={ALL_VIEW}>All ({ordered.length})</TabsTrigger>
        </TabsList>
      </BottomTabBar>
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
  );
}
